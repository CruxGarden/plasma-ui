/** Default maximum plasma shapes drawn at once (offscreen shapes are culled first). */
export const DEFAULT_MAX_SHAPES = 16;
/** Maximum concurrent pulses. */
export const MAX_PULSES = 4;

export const vert = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;

export interface ShaderSet { maskFrag: string; tintFrag: string; blurFrag: string; bgFrag: string; compFrag: string }

/** Build the shader set for a given surface budget (compiled into the programs). */
export function makeShaders(MAX_SHAPES: number): ShaderSet {
const common = `
precision highp float;
uniform vec2 uRes; uniform vec4 uView; uniform float uScale, uTime, uGoo, uEnergy, uLight, uMouseAmt, uDropR, uAmbient, uScroll, uVisc, uFlow, uTension, uThick;
uniform vec2 uMouse;
uniform vec4 uP[${MAX_SHAPES}]; uniform vec4 uR[${MAX_SHAPES}]; uniform float uF[${MAX_SHAPES}]; uniform vec4 uT[${MAX_SHAPES}]; uniform float uFr[${MAX_SHAPES}]; uniform float uEl[${MAX_SHAPES}]; uniform float uSolo[${MAX_SHAPES}];
uniform int uCount;
uniform vec4 uRip[${MAX_PULSES}];
uniform vec3 uA, uB, uC;

float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
}
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
float smin(float a, float b, float k){ float h=max(k-abs(a-b),0.)/k; return min(a,b)-h*h*k*.25; }

// Rounded box distance plus its outward direction.
// r holds per-corner radii (top-right, bottom-right, top-left, bottom-left), y pointing down.
// The last component is 1 near a squared-off corner (one that sits against a neighbor),
// where blending would otherwise raise a bump at the seam.
vec4 sdBoxG(vec2 p, vec2 b, vec4 rc, float rmax){
  float r = p.x > 0. ? (p.y > 0. ? rc.y : rc.x) : (p.y > 0. ? rc.w : rc.z);
  vec2 q = abs(p) - b + r;
  vec2 mq = max(q, 0.);
  float lo = length(mq);
  vec2 g = lo > 0. ? mq / lo : (q.x > q.y ? vec2(1., 0.) : vec2(0., 1.));
  float sharp = (mq.x > 0. && mq.y > 0.) ? 1. - smoothstep(0., rmax * .35 + .01, r) : 0.;
  return vec4(lo + min(max(q.x, q.y), 0.) - r, g * sign(p + 1e-5), sharp);
}

float scene(vec2 p){
  float d = 1e4;      // fusing surfaces, blended
  float ds = 1e4;     // solo surfaces (fuse={false}), hard union only
  vec2 g = vec2(0.);
  float sh = 0.;
  for(int i=0;i<uCount;i++){
    float f = uF[i];
    if(f < .005) continue;
    vec2 c = uP[i].xy; vec2 h = uP[i].zw * f;
    float rmax = max(max(uR[i].x, uR[i].y), max(uR[i].z, uR[i].w));
    vec4 bx = sdBoxG(p-c, h, min(uR[i], vec4(min(h.x, h.y))), rmax);
    if(uSolo[i] > .5){ ds = min(ds, bx.x); continue; }
    if(d > 1e3){ d = bx.x; g = bx.yz; sh = bx.w; continue; }
    // Blend only where surfaces face different ways (corners, gaps, steps);
    // edges that face the same way stay perfectly straight.
    float k = uGoo * clamp((1. - dot(g, bx.yz)) / .8, 0., 1.) * (1. - sh) * (1. - bx.w);
    float nd = k < .5 ? min(d, bx.x) : smin(d, bx.x, k);
    if(bx.x < d){ g = bx.yz; sh = bx.w; }
    d = nd;
  }
  d = min(d, ds);
  if(uAmbient > .5){
    float t = uTime*.4;
    vec2 home = uView.xy + vec2(uView.z*.88, uView.w*.74);
    d = smin(d, length(p - home - vec2(cos(t),sin(t*1.3))*70.) - 38., uGoo);
    d = smin(d, length(p - home - vec2(cos(t*1.7+2.),sin(t*.9+1.))*90.) - 26., uGoo);
    d = smin(d, length(p - home - vec2(sin(t*.7),cos(t*1.1))*40.) - 20., uGoo);
  }
  if(uDropR > 0.){
    d = smin(d, length(p-uMouse) - uDropR*uMouseAmt, 18.);
    float md = length(p-uMouse);
    d -= 3. * uMouseAmt * exp(-md*md/4000.);
  }
  for(int i=0;i<${MAX_PULSES};i++){
    float age = uTime - uRip[i].z;
    if(age < 0. || age > 3.) continue;
    float ring = length(p-uRip[i].xy) - age*mix(680., 330., uVisc);
    d -= uRip[i].w * mix(5., 2., uVisc) * exp(-ring*ring/900.) * exp(-age*mix(.8, 2.6, uVisc));
  }
  // slow ripple along the outline
  if(uFlow > 0.) d += uFlow * 5. * (noise(p/70. + vec2(uTime*.23, -uTime*.17)) - .5) * mix(1.4, .6, uVisc);
  return d;
}
vec2 fragPos(){ return vec2(gl_FragCoord.x, uRes.y*uScale - gl_FragCoord.y) / uScale; }
`;

/** Pass 1: the combined silhouette. */
const maskFrag = `#version 300 es
${common}
out vec4 o;
void main(){ o = vec4(smoothstep(1.5, -1.5, scene(fragPos()))); }`;

/**
 * Pass 1b: tint layer. Each pixel inside the material takes a distance-weighted mix
 * of nearby shapes' tints, stored premultiplied by the silhouette so it can be blurred
 * and then un-premultiplied. Joined panels with different tints flow into each other.
 */
const tintFrag = `#version 300 es
${common}
layout(location = 0) out vec4 o;
layout(location = 1) out vec4 o2;
void main(){
  vec2 p = fragPos();
  float m = smoothstep(1.5, -1.5, scene(p));
  vec4 acc = vec4(0.); float fr = 0.; float el = 0.; float wsum = 0.;
  for(int i=0;i<uCount;i++){
    if(uF[i] < .005) continue;
    vec2 h = uP[i].zw * uF[i];
    float rmax = max(max(uR[i].x, uR[i].y), max(uR[i].z, uR[i].w));
    float d = sdBoxG(p - uP[i].xy, h, min(uR[i], vec4(min(h.x, h.y))), rmax).x;
    float w = exp(-max(d, 0.) / 18.) * (1. + smoothstep(0., -24., d) * 4.);
    acc += uT[i] * w; fr += uFr[i] * w; el += uEl[i] * w; wsum += w;
  }
  vec4 t = wsum > 0. ? acc / wsum : vec4(0.);
  o = vec4(t.rgb * m, t.a * m);
  o2 = vec4((wsum > 0. ? fr / wsum : 0.) * m, (wsum > 0. ? el / wsum : 0.) * m, 0., 1.);
}`;

/** Pass 2: separable Gaussian blur (13 taps via linear sampling). */
const blurFrag = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uDir, uOut;
out vec4 o;
void main(){
  vec2 ts = vec2(textureSize(uTex, 0));
  vec2 uv = gl_FragCoord.xy / uOut;
  vec2 st = uDir / ts;
  vec4 s = texture(uTex, uv) * .1964825501511404;
  s += (texture(uTex, uv + st*1.411764705882353) + texture(uTex, uv - st*1.411764705882353)) * .2969069646728344;
  s += (texture(uTex, uv + st*3.2941176470588234) + texture(uTex, uv - st*3.2941176470588234)) * .09447039785044732;
  s += (texture(uTex, uv + st*5.176470588235294) + texture(uTex, uv - st*5.176470588235294)) * .010381362401148057;
  o = s;
}`;

/** Pass 0: the procedural background (with pulse distortion), drawn once per frame. */
const bgFrag = `#version 300 es
${common}
uniform sampler2D uImg;
uniform vec2 uImgRes;
uniform float uHasImg;
uniform vec3 uBgColor;
uniform float uBgSolid;
out vec4 o;
vec3 bg(vec2 p){
  p.y += uScroll;
  vec2 q = p/520.;
  float t = uTime*.035;
  vec2 w = vec2(fbm(q+t), fbm(q+vec2(5.2,1.3)-t));
  float n = fbm(q*1.4 + w*1.8 + t*.6);
  vec3 col = mix(uA, uB, smoothstep(.25,.75,n));
  col = mix(col, uC, smoothstep(.55,.9, w.x*n*1.6));
  float lines = abs(fract(n*14.)-.5);
  col += (1.-smoothstep(0.,.06,lines)) * .07 * (0.6+uEnergy);
  vec2 v = (p - vec2(0., uScroll) - uView.xy)/uView.zw - .5;
  col *= .55 + .45*smoothstep(1.2,.2,length(v));
  return mix(col, mix(vec3(.90,.93,.95), col, .42), uLight);
}
void main(){
  vec2 p = fragPos();
  vec2 bp = p;
  for(int i=0;i<${MAX_PULSES};i++){
    float age = uTime - uRip[i].z;
    if(age < 0. || age > 3.) continue;
    vec2 dir = normalize(p-uRip[i].xy+.001);
    float ring = length(p-uRip[i].xy) - age*mix(680., 330., uVisc);
    bp -= dir * uRip[i].w * mix(18., 9., uVisc) * exp(-ring*ring/2500.) * exp(-age*mix(.7, 2.2, uVisc));
  }
  if (uBgSolid > .5) {
    // solid color background: subtle luminance drift so refraction stays visible
    float shade = (fbm(p*.0012 + vec2(uTime*.02, -uTime*.015)) - .5) * .10
                + (fbm(p*.004 + 7.3) - .5) * .04
                + length(bp - p) * .004;
    o = vec4(uBgColor * (1. + shade), 1.);
    return;
  }
  if (uHasImg > .5) {
    // image background: slow swirl plus the pulse warp above
    vec2 q = bp;
    q += (vec2(sin(q.y*.006 + uTime*.22), cos(q.x*.005 + uTime*.17)) * 7.
        + vec2(fbm(q*.004 + uTime*.05) - .5, fbm(q*.004 + 31.7 - uTime*.04) - .5) * 22.)
        * (.5 + uFlow*.5);
    // cover-fit the image to the canvas
    float sc = max(uView.z / uImgRes.x, uView.w / uImgRes.y);
    vec2 uv = (q - uView.xy - .5*uView.zw) / (uImgRes * sc) + .5;
    o = vec4(texture(uImg, clamp(uv, 0., 1.)).rgb, 1.);
    return;
  }
  o = vec4(bg(bp), 1.);
}`;

/** Pass 3: smoothed outline and plasma shading over the background textures. */
const compFrag = `#version 300 es
${common}
uniform sampler2D uH, uS, uTint, uBg, uBgM, uBgH, uFrost;
uniform float uRefract, uDisp, uRim, uRimMode, uRimWidth, uSpec, uHair, uShim, uGlow, uWash, uGrain;
// Which material the surfaces are made of, and the one light every opaque one
// reads. Glass fakes its lighting off the pointer because you see through it;
// the moment anything is opaque, two materials disagreeing about where the sun
// is looks broken in a way no single shader can fix. So there is one light.
uniform float uMat;
uniform vec3 uLightDir;
// Surface finish, shared by every material that has one: 0 is a mirror, 1 is
// chalk. Anisotropy stretches the highlight along the grain — brushed metal
// and varnished wood both need it, and neither reads right without it.
uniform float uRough, uAniso;
// How thick a panel is, in CSS px, and how much the material rounds itself
// against that. Mercury has enormous surface tension, so a bead pulls toward
// a sphere; tension drives both the corner radius and how eagerly two beads
// merge into one body.
// The edge treatment. A rounded rectangle is right for a liquid, and wrong for
// almost everything else: stone chips, cloud billows, metal is cut. These
// displace the silhouette itself — amplitude in CSS px, scale in cycles —
// before anything decides what is inside, so the outline, the rim, the shadow
// and the material all agree about where the panel ends.
uniform float uEdge, uEdgeScale, uEdgeSharp;
uniform vec3 uRimColor;
out vec4 o;

vec3 pal(float t){ return .5 + .5*cos(6.2831*(t + vec3(0., .33, .67))); }
float H(vec2 uv){ return texture(uH, uv).r; }
// Clamped, because a reflection offset is far larger than a refraction one:
// metal sweeps up to 150px and walks straight off the texture, where
// CLAMP_TO_EDGE smears the last row of pixels into arcs across the panel.
vec2 uvAt(vec2 q){ return clamp(vec2(q.x, uRes.y - q.y) / uRes, vec2(.001), vec2(.999)); }
// background seen through plasma with frost f: sharp, then medium, then heavy blur
vec3 seen(vec2 q, float f){
  vec2 u = uvAt(q);
  vec3 sharp = texture(uBg, u).rgb;
  if(f < .002) return sharp;
  vec3 soft = mix(texture(uBgM, u).rgb, texture(uBgH, u).rgb, smoothstep(.45, 1., f));
  return mix(sharp, soft, smoothstep(0., .45, f));
}
// ── Shading kit ───────────────────────────────────────────────────────────
// A real microfacet BRDF, not pow(ndl, n). GGX + height-correlated Smith +
// Schlick is what every modern renderer uses, and it is the single biggest
// difference between a material that reads as itself and one that reads as
// coloured plastic.
float D_GGX(float ndh, float a){ float a2 = a*a; float d = ndh*ndh*(a2-1.)+1.; return a2/(3.14159265*d*d + 1e-7); }
// Anisotropic GGX: the highlight stretches along a direction. This is the tell
// for wood and for brushed metal — an isotropic highlight on wood looks wrong
// even when nothing else does.
float D_GGXaniso(float ndh, float tdh, float bdh, float ax, float ay){
  float d = tdh*tdh/(ax*ax) + bdh*bdh/(ay*ay) + ndh*ndh;
  return 1./(3.14159265*ax*ay*d*d + 1e-7);
}
float V_SmithGGX(float ndv, float ndl, float a){
  float a2 = a*a;
  float gv = ndl*sqrt(ndv*ndv*(1.-a2)+a2);
  float gl = ndv*sqrt(ndl*ndl*(1.-a2)+a2);
  return .5/max(gv+gl, 1e-5);
}
vec3 F_Schlick(vec3 f0, float u){ return f0 + (1.-f0)*pow(clamp(1.-u,0.,1.), 5.); }

// Lighting has to happen in linear light. Doing it in gamma space is the
// oldest way to make a render look cheap: highlights clip early and midtones
// go chalky. sqrt/square is the standard cheap sRGB pair.
vec3 toLinear(vec3 c){ return c*c; }
vec3 toSrgb(vec3 c){ return sqrt(max(c, 0.)); }
// ACES filmic, fitted. Keeps a bright specular from flattening into white.
vec3 tonemap(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14), 0., 1.); }

// Plain fbm reads as fractal mush. Warping the domain by another fbm is what
// makes grain and rock look grown rather than generated — the background
// shader already leans on this.
vec2 warp(vec2 q, float k){
  return q + k*vec2(fbm(q + vec2(1.7, 9.2)), fbm(q + vec2(5.3, 2.8)));
}

// Metal only reads as metal when it reflects something with structure, and a
// page background is nearly uniform — reflect it alone and you get grey paint
// with a shiny rim. So reflective materials also see a small studio: a sky
// gradient, a horizon, and a sun in the same direction as the light. Roughness
// widens the sun and flattens the band, which is what a prefiltered
// environment map does for real.
vec3 envmap(vec3 R, float rough){
  float h = clamp(R.y * .5 + .5, 0., 1.);
  vec3 sky = mix(vec3(.62, .70, .84), vec3(.10, .13, .19), pow(1. - h, 1.5));
  vec3 ground = vec3(.055, .05, .048);
  vec3 c = mix(ground, sky, smoothstep(.40, .60, h));
  vec3 L = normalize(uLightDir);
  float sun = pow(max(dot(R, L), 0.), mix(260., 5., rough));
  c += vec3(1., .96, .88) * sun * (1. - rough * .7) * 2.2;
  // the horizon band is what gives a curved metal edge its sweep
  c += vec3(.75, .82, .95) * (1. - smoothstep(.0, .22, abs(h - .54))) * .45 * (1. - rough * .55);
  return c;
}

// ── The scene as a solid ──────────────────────────────────────────────────
// Everything above shades a flat card: a 2D silhouette, a perturbed normal,
// a texture lookup. That is skinning, and it is why wood came out looking
// like a wood-effect laminate. A material reads as a material when there is a
// body to light — so the same shapes are extruded into a slab and the view ray
// is marched through it, the way a game would.
//
// The 2D mask is a free conservative bound: outside it there is nothing to
// hit, so the march never starts.
float map3(vec3 q, float tension, float thick){
  float d = 1e5;
  for (int i = 0; i < uCount; i++) {
    float f = uF[i];
    if (f < .005) continue;
    vec2 c = uP[i].xy;
    vec2 h = uP[i].zw * f;
    float rmax = max(max(uR[i].x, uR[i].y), max(uR[i].z, uR[i].w));
    // The footprint is the element's, exactly as plasma's is. Mercury is not
    // a blob that swallows the layout — it is a panel, poured. Tension belongs
    // to the edge and to the merge, not to the shape: pulling the whole
    // footprint toward a disc threw the panel away and left content floating
    // over nothing.
    float d2 = sdBoxG(q.xy - c, h, min(uR[i], vec4(min(h.x, h.y))), rmax).x;
    // Extrude, with the rim rolled over so the slab has a shoulder rather than
    // a cut edge. Tension fattens that roll — where a bead of mercury reads as
    // poured is its edge, not its outline.
    float roll = thick * (.22 + .50 * tension);
    vec2 w = vec2(d2 + roll, abs(q.z) - (thick - roll));
    float de = min(max(w.x, w.y), 0.) + length(max(w, 0.)) - roll;
    d = (i == 0) ? de : smin(d, de, uGoo * (.6 + 1.8 * tension));
  }
  // Two slow swells across the whole body, displacing the surface itself
  // rather than tilting a normal — the march finds a moving surface, so the
  // reflection travels over real waves. This is what separates water from a
  // picture of water.
  // Displacing a distance field costs it the property the march depends on:
  // d is no longer a safe distance, so a full step overshoots the surface and
  // the ray lands inside, which is the mottled crust this produced at first.
  // The amplitude is kept small and the march below steps at a fraction, which
  // is the standard price of displacement.
  if (tension > .01) {
    float wv = (fbm(q.xy * .0075 + vec2(uTime * .11, uTime * .06)) - .5) * 1.6
             + (fbm(q.xy * .019 - vec2(uTime * .08, uTime * .13)) - .5) * .6;
    d -= wv * thick * .07 * tension;
  }
  return d;
}

// ── The gem ───────────────────────────────────────────────────────────────
// Facet directions, spread over a hemisphere and mirrored, standing in for a
// cut stone's crown and pavilion. Generated rather than tabulated so the count
// is a constant to change, not a table to rewrite.
vec3 facetN(int i){
  float fi = float(i);
  float a = fi * 2.3999632;                       // golden angle, so they do not band
  float z = mix(.22, .92, fract(fi * .6180339));
  float r = sqrt(max(0., 1. - z * z));
  return normalize(vec3(cos(a) * r, sin(a) * r, z));
}

/**
 * The panel as a piece of gem. The slab is the element's own footprint,
 * extruded; the facets are half-spaces cut through it.
 *
 * The cuts are anchored in PAGE space, not the panel's, which is the whole
 * trick: a facet plane runs on across the gap and slices the next panel too,
 * so the panels read as pieces carved out of one stone rather than as
 * separate gems that happen to match.
 */
float mapGem(vec3 q, float thick, float cut){
  float d = 1e5;
  for (int i = 0; i < uCount; i++) {
    float f = uF[i];
    if (f < .005) continue;
    vec2 c = uP[i].xy;
    vec2 h = uP[i].zw * f;
    float rmax = max(max(uR[i].x, uR[i].y), max(uR[i].z, uR[i].w));
    float d2 = sdBoxG(q.xy - c, h, min(uR[i], vec4(min(h.x, h.y))), rmax).x;
    vec2 w = vec2(d2, abs(q.z) - thick);
    float de = min(max(w.x, w.y), 0.) + length(max(w, 0.)) - 1.5;
    d = (i == 0) ? de : min(d, de);
  }
  // Cut the stone. Each plane repeats on a lattice so the whole page is one
  // crystal the panels are taken out of. Six directions, and the lattice is
  // wide — a few facets across a panel, not hundreds. Cut it finely and a gem
  // stops being a gem and becomes gravel, which is exactly what nine planes at
  // 34px produced on the first try.
  for (int i = 0; i < 6; i++) {
    vec3 nn = facetN(i);
    if (fract(float(i) * .5) > .25) nn.z = -nn.z;   // mirror half of them below
    // The plane sits near the far end of its lattice cell, so a cut trims a
    // corner instead of slicing the body in half. Six planes at 70% of the
    // cell removed most of the volume and left the panels as floating shards.
    // A gem is faceted, not shattered.
    float hgt = dot(q, nn);
    float plane = floor(hgt / cut) * cut + cut * .965;
    d = max(d, hgt - plane);
  }
  return d;
}

vec3 gemNormal(vec3 q, float thick, float cut){
  vec2 e = vec2(.4, 0.);
  return normalize(vec3(
    mapGem(q + e.xyy, thick, cut) - mapGem(q - e.xyy, thick, cut),
    mapGem(q + e.yxy, thick, cut) - mapGem(q - e.yxy, thick, cut),
    mapGem(q + e.yyx, thick, cut) - mapGem(q - e.yyx, thick, cut)
  ));
}

vec3 normal3(vec3 q, float tension, float thick){
  vec2 e = vec2(.75, 0.);
  return normalize(vec3(
    map3(q + e.xyy, tension, thick) - map3(q - e.xyy, tension, thick),
    map3(q + e.yxy, tension, thick) - map3(q - e.yxy, tension, thick),
    map3(q + e.yyx, tension, thick) - map3(q - e.yyx, tension, thick)
  ));
}

// Worley/Voronoi: nearest cell, second nearest, and the cell's id. The gap
// between the two is the distance to a cell wall, which is what draws the
// seams of a crystal without any geometry.
vec4 voronoi(vec2 q){
  vec2 ip = floor(q), fp = fract(q);
  float d1 = 8., d2 = 8.;
  vec2 id = vec2(0.);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 cell = ip + g;
      vec2 o = vec2(hash(cell), hash(cell + 31.7));
      vec2 r = g + o - fp;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; id = cell; }
      else if (d < d2) { d2 = d; }
    }
  }
  return vec4(sqrt(d1), sqrt(d2), id);
}

// B-spline bicubic from four bilinear taps keeps curved outlines round.
float S(vec2 uv){
  vec2 ts = vec2(textureSize(uS, 0));
  vec2 st = uv*ts - .5;
  vec2 i = floor(st), f = st - i;
  vec2 f2 = f*f, f3 = f2*f;
  vec2 w0 = (1. - 3.*f + 3.*f2 - f3)/6.;
  vec2 w1 = (4. - 6.*f2 + 3.*f3)/6.;
  vec2 w2 = (1. + 3.*f + 3.*f2 - 3.*f3)/6.;
  vec2 w3 = f3/6.;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 h0 = (w1/g0 - 1. + i + .5)/ts;
  vec2 h1 = (w3/g1 + 1. + i + .5)/ts;
  return g0.y*(g0.x*texture(uS, vec2(h0.x,h0.y)).r + g1.x*texture(uS, vec2(h1.x,h0.y)).r)
       + g1.y*(g0.x*texture(uS, vec2(h0.x,h1.y)).r + g1.x*texture(uS, vec2(h1.x,h1.y)).r);
}

void main(){
  vec2 p = fragPos();
  vec2 uv = gl_FragCoord.xy / (uRes*uScale);
  vec2 tx = 1. / vec2(textureSize(uS, 0));
  float cssPerTexel = uRes.x / float(textureSize(uS, 0).x);

  float s = S(uv);
  vec2 gs = vec2(S(uv+vec2(tx.x,0.)) - S(uv-vec2(tx.x,0.)), S(uv+vec2(0.,tx.y)) - S(uv-vec2(0.,tx.y))) / (2.*cssPerTexel);
  float sd = clamp((s - .5) / max(length(gs), 1e-3), -60., 60.);
  if (uEdge > .01) {
    // Two octaves: the first gives the large shape (billows, chips), the
    // second the fine break-up. Warping keeps it from reading as a sine wave
    // stamped around the outline.
    vec2 ep = warp(p * uEdgeScale, .7);
    float e1 = fbm(ep) - .5;
    float e2 = fbm(ep * 3.3 + 17.) - .5;
    float disp = e1 * 1.5 + e2 * .55;
    // uEdgeSharp 0 leaves it rolling; 1 pushes it toward flats and points,
    // which is what reads as chipped rather than melted.
    disp = mix(disp, sign(disp) * pow(abs(disp) * 2., .55) * .5, clamp(uEdgeSharp, 0., 1.));
    sd += disp * uEdge;
  }

  vec3 back = texture(uBg, uv).rgb;
  float grain = 1.;

  // shadow: offset and strength follow the surface's elevation
  float msk = max(texture(uS, uv).r, 1e-3);
  float elHere = clamp(texture(uFrost, uv).g / msk, 0., 1.);
  float elCast = clamp(texture(uFrost, uv - vec2(0., 20. / uRes.y)).g / max(texture(uS, uv - vec2(0., 20. / uRes.y)).r, 1e-3), 0., 1.);
  float el = max(elHere, elCast);
  float hs = H(uv + vec2(0., (4. + el * 28.) / uRes.y));
  float shStr = .5 * smoothstep(0., .12, el) * clamp(el + .35, 0., 1.);
  vec3 col = back * (1. - shStr*smoothstep(.02, .55, hs)*(1.-uLight*.6));
  float hHere = H(uv);
  // Palette phases run on viewport position, like the grain: a frame drawn for
  // a taller region must colour its viewport band exactly as the live frame does.
  vec2 vp = p - uView.xy;
  col += pal(uTime*.03 + vp.x/1400.) * .06 * smoothstep(.0, .45, hHere) * (1.+uEnergy) * uGlow;

  if(sd > -2.){
    vec2 th = 2. / vec2(textureSize(uH, 0));
    vec2 g = vec2(H(uv+vec2(th.x,0.)) - H(uv-vec2(th.x,0.)), H(uv+vec2(0.,th.y)) - H(uv-vec2(0.,th.y)));
    g.y = -g.y;
    float slope = clamp(length(g) / .16, 0., 1.);
    vec2 n = -g / (length(g) + 1e-4);
    float bevel = 1. - smoothstep(.42, .97, hHere);
    float depth = 1. - bevel;
    float lift = sqrt(1. - bevel*bevel);

    vec2 off = -n * pow(bevel, 2.2) * 50. * slope * uRefract;
    float disp = (.16 + uEnergy*.1) * uDisp;
    float fr = clamp(texture(uFrost, uv).r / msk, 0., 1.);
    vec3 refr = vec3(
      seen(p + off*(1.+disp), fr).r,
      seen(p + off, fr).g,
      seen(p + off*(1.-disp), fr).b
    );
    // uWash 0 hands the background through untouched - glass with no cast of
    // its own. 1 is the original desaturate-and-lift that gives the material
    // its body.
    vec3 clearRefr = refr;
    refr = mix(refr, vec3(dot(refr, vec3(.333))), .18) * mix(1.08, .9, uLight) + .03*(1.-uLight);
    refr = mix(clearRefr, refr, uWash);
    // frosted: milkier and a little brighter
    refr = mix(refr, mix(refr, vec3(dot(refr, vec3(.333))), .25) * mix(1.12, .97, uLight) + mix(.05, .03, uLight), fr);
    float hl = 1. - .55*uLight;

    // tint: un-premultiply by the equally blurred silhouette
    vec4 tn = texture(uTint, uv);
    vec3 tcol = clamp(tn.rgb / msk, 0., 1.);
    float talpha = clamp(tn.a / msk, 0., 1.);
    // a little of the background shows through partial tints; full opacity is a flat color
    refr = mix(refr, tcol * mix(1., .92, uLight) + refr * .08 * (1. - talpha), talpha);

    vec2 L = normalize(uMouse - p + vec2(0., -200.));
    float spec = pow(max(dot(n, L), 0.), 26.) * pow(bevel, 2.) * slope;
    float fres = pow(bevel, 5. / max(uRimWidth, .05)) * slope;
    // rim color: 0 iridescent, 1 solid color, 2 each surface's tint
    vec3 rimCol = pal(dot(n, L)*.35*slope + depth*.8 + uTime*.04 + uEnergy*.3);
    float facing = .75 + .5 * max(dot(n, L), 0.) * slope;
    if (uRimMode > .5 && uRimMode < 1.5) rimCol = uRimColor * facing * 1.4;
    else if (uRimMode > 1.5) rimCol = tcol * facing * 1.4;

    // A 3D normal from the 2D height gradient: flat in the middle, turning
    // outward and down across the bevel. Every material shades from this, and
    // the opaque ones perturb it further with their own detail.
    vec3 Nb = normalize(vec3(n * (.30 + .70 * bevel), max(.20, 1. - bevel)));
    vec3 Ldir = normalize(uLightDir);
    vec3 V = vec3(0., 0., 1.);            // orthographic view, straight on
    vec3 plasma = refr;
    float a = smoothstep(-.8, .8, sd);

    if (uMat < .5) {
      // ── plasma ────────────────────────────────────────────────────────
      plasma += rimCol * fres * .45 * hl * uRim;
      plasma += vec3(1.) * spec * .75 * hl * uSpec;
      // faint shimmer across the body; fades out as the tint becomes opaque
      plasma += pal(uTime*.04 + vp.y/900. + uEnergy*.3) * .05 * lift * (1.+uEnergy*2.) * hl * (1. - talpha) * uShim;
      vec3 hairCol = uRimMode > .5 ? mix(vec3(1.), rimCol / 1.4, .6) : vec3(.9,.95,1.);
      plasma += hairCol * (1.-smoothstep(0., 1.6, abs(sd - .7))) * .4 * hl * uHair;
    } else if (uMat < 1.5) {
      // ── crystal ───────────────────────────────────────────────────────
      // Modelled, not textured. The panel is a faceted solid; the ray enters
      // it, bounces around inside by total internal reflection, and leaves
      // through whichever facet finally lets it out. That bouncing is where a
      // gem's life comes from — a stone with one refraction through it looks
      // like tinted glass.
      float gthick = max(uThick, 10.);
      // Facet size in page px. Big, so a panel is a few faces of one stone.
      float gcut = max(gthick * 11., 240.);
      vec3 gro = vec3(p, gthick * 4.);
      vec3 grd = normalize(vec3((p - uMouse) * .00022, -1.));

      float gt = 0.;
      bool ghit = false;
      for (int i = 0; i < 80; i++) {
        vec3 q = gro + grd * gt;
        float dd = mapGem(q, gthick, gcut);
        if (dd < .25) { ghit = true; break; }
        gt += max(dd * .70, .30);
        if (gt > gthick * 9.) break;
      }

      if (!ghit) {
        a = 0.;
      } else {
        vec3 q0 = gro + grd * gt;
        vec3 N0 = gemNormal(q0, gthick, gcut);
        float ndv0 = max(dot(N0, -grd), 1e-3);

        // Diamond's F0 is about 0.17 — far brighter than glass, which is why a
        // gem throws back so much light before you ever see into it.
        vec3 F0 = vec3(.17);
        vec3 Fr = F_Schlick(F0, ndv0);
        vec3 refl = envmap(reflect(grd, N0), .02);

        // Dispersion: three traces, one per channel, at slightly different
        // indices. This is where the fire comes from — the same ray leaves by
        // different facets depending on its wavelength.
        vec3 through = vec3(0.);
        for (int ch = 0; ch < 3; ch++) {
          float ior = 2.417 + (float(ch) - 1.) * .022 * max(uDisp, .001) * 6.;
          vec3 rd2 = refract(grd, N0, 1. / ior);
          vec3 pos = q0 - N0 * .6;
          vec3 outDir = rd2;
          float path = 0.;
          // Up to three internal bounces, which is where the sparkle lives.
          for (int b = 0; b < 3; b++) {
            float ti = 0.;
            bool inside = false;
            for (int i = 0; i < 48; i++) {
              vec3 qq = pos + rd2 * ti;
              float dd = -mapGem(qq, gthick, gcut);   // inside, the field is negative
              if (dd < .25) { inside = true; break; }
              ti += max(dd * .70, .30);
              if (ti > gthick * 12.) break;
            }
            if (!inside) break;
            pos = pos + rd2 * ti;
            path += ti;
            vec3 Ni = -gemNormal(pos, gthick, gcut);   // facing into the material
            vec3 outv = refract(rd2, Ni, ior);
            if (dot(outv, outv) < 1e-6) {
              // Total internal reflection: the ray cannot leave here, so it
              // stays in the stone and keeps going.
              rd2 = reflect(rd2, Ni);
              pos += rd2 * .8;
            } else {
              outDir = outv;
              break;
            }
          }
          // What that ray finally sees, and what the stone took out of it on
          // the way (Beer-Lambert over the path it travelled).
          vec3 far = mix(envmap(outDir, .0), toLinear(seen(p + outDir.xy * 190., 0.)), .45);
          float absorb = exp(-path * .004);
          through[ch] = far[ch] * absorb;
        }
        vec3 tint3 = toLinear(mix(vec3(1.), tcol, talpha * .7));
        vec3 cr = through * tint3 * (1. - Fr) + refl * Fr;

        // A hard specular on the entry facet, and the glint: facets nearly
        // edge-on to the light flash, which is the discrete sparkle a gem has
        // and a smooth highlight never does.
        vec3 H = normalize(Ldir - grd);
        float aa = .015 * .015;
        float ndl0 = max(dot(N0, Ldir), 0.);
        cr += F_Schlick(F0, max(dot(H, -grd), 0.))
            * D_GGX(max(dot(N0, H), 0.), aa) * V_SmithGGX(ndv0, ndl0, aa) * ndl0 * 22. * uSpec;
        plasma = toSrgb(tonemap(cr * 1.15));
        a = 1.;
      }
    } else if (uMat < 3.5) {
      bool merc = uMat > 2.5;
      if (merc) {
        // ── mercury ─────────────────────────────────────────────────────
        // Marched, not painted. The ray enters the slab, and every normal
        // below comes from the solid's own gradient — which is what makes a
        // bead read as a bead instead of a rectangle with a chrome gradient
        // on it. Surface tension does the rest: the footprint rounds toward a
        // disc, and two panels within reach pull into one body with a neck.
        float thick = max(uThick, 8.);
        float tension = clamp(uTension, 0., 1.);
        vec3 ro = vec3(p, thick * 3.5);
        vec3 rd = normalize(vec3((p - uMouse) * .00035, -1.));   // a hair of perspective
        float t = 0., hit = -1.;
        for (int i = 0; i < 96; i++) {
          vec3 q = ro + rd * t;
          float dd = map3(q, tension, thick);
          if (dd < .35) { hit = t; break; }
          t += max(dd * .30, .25);
          if (t > thick * 8.) break;
        }
        if (hit < 0.) {
          a = 0.;                       // the march missed: leave the ground
        } else {
          vec3 q = ro + rd * hit;
          vec3 Nm = normal3(q, tension, thick);
          float ndv = max(dot(Nm, -rd), 1e-3);
          float ndl = max(dot(Nm, Ldir), 0.);
          vec3 H = normalize(Ldir - rd);
          vec3 R = reflect(rd, Nm);

          float rough = .04;
          // A real reflection off a real normal, of the studio and of what is
          // actually behind the bead.
          vec2 roff = R.xy * 210.;
          vec3 env = mix(envmap(R, rough), toLinear(seen(p - roff, rough)), .30);
          vec3 F0 = mix(vec3(.86, .87, .90), toLinear(tcol), talpha);
          vec3 Fr = F_Schlick(F0, ndv);
          float aa = max(rough * rough, 1e-4);
          vec3 sun = F_Schlick(F0, max(dot(H, -rd), 0.))
                   * D_GGX(max(dot(Nm, H), 0.), aa)
                   * V_SmithGGX(ndv, ndl, aa) * ndl;
          vec3 me = env * Fr + sun * 16. * uSpec;
          me += F0 * .03;
          // Shimmer comes from the modelled swell moving under a sharp
          // highlight, not from a noise field tinting the surface. The only
          // colour added is thin-film interference, which is a function of the
          // angle the geometry presents — no texture in it.
          me += toLinear(pal(pow(1. - ndv, 1.6) * 1.4)) * .12 * uShim * pow(1. - ndv, .9);
          plasma = toSrgb(tonemap(me));
          // The silhouette is the march's, so a bead that has pulled away from
          // the rectangle actually looks pulled away.
          a = 1.;
        }
      } else {
        // ── metal ───────────────────────────────────────────────────────
        // Milled, not poured: flat stock with a cut edge. Still the screen
        // space path, which is honest for a flat sheet.
        float rough = clamp(uRough, .04, .95);
        vec3 Nm = Nb;
        float aniso = uAniso;
        if (aniso > .01) {
          float brush = fbm(vec2(p.x * .9, p.y * 22.)) - .5;
          Nm = normalize(Nm + vec3(0., brush * aniso * .55, 0.));
        }
        float mr = fbm(p * .035) - .5;
        Nm = normalize(Nm + vec3(mr * .16, (fbm(p * .035 + 11.) - .5) * .16, 0.));
        float ndv = max(dot(Nm, V), 1e-3);
        float ndl = max(dot(Nm, Ldir), 0.);
        vec3 H = normalize(Ldir + V);
        vec3 R = reflect(-V, Nm);
        vec2 roff = R.xy * pow(bevel, .9) * 150. * (1. - rough * .5);
        vec3 env = mix(envmap(R, rough), toLinear(seen(p - roff, rough)), .22);
        vec3 F0 = mix(vec3(.95, .93, .88), toLinear(tcol), talpha);
        vec3 Fr = F_Schlick(F0, ndv);
        float aa = max(rough * rough, 1e-3);
        float D = aniso > .01
          ? D_GGXaniso(max(dot(Nm, H), 0.), dot(vec3(1.,0.,0.), H), dot(vec3(0.,1.,0.), H), aa * (1. + aniso * 3.), aa)
          : D_GGX(max(dot(Nm, H), 0.), aa);
        vec3 sun = F_Schlick(F0, max(dot(H, V), 0.)) * D * V_SmithGGX(ndv, ndl, aa) * ndl;
        vec3 me = env * Fr + sun * 14. * uSpec;
        me += F0 * .035;
        plasma = toSrgb(tonemap(me));
      }
    } else if (uMat < 4.5) {
      // ── wood ──────────────────────────────────────────────────────────
      // Grain lives in page coordinates, so a panel that resizes keeps its
      // grain instead of stretching it — the first thing an opaque natural
      // material asks for that glass never did.
      vec2 wp = p * .0021;
      // Rings are warped, then squeezed across one axis: straight fbm reads as
      // camouflage, warped fbm reads as a board cut from a trunk.
      vec2 wq = warp(vec2(wp.x * .40, wp.y * 4.2), .55);
      float ring = fract(fbm(wq) * 2.05);
      float band = abs(ring - .5) * 2.;
      float pore = fbm(vec2(p.x * .18, p.y * .022));
      float h0 = band * .7 + pore * .3;
      // Detail normal by finite difference of that height, so the grain
      // actually catches the light instead of being painted on.
      vec2 e = vec2(1.4, 0.);
      float hx = fract(fbm(warp(vec2((wp.x + e.x*.0021) * .40, wp.y * 4.2), .55)) * 2.05);
      float hy = fract(fbm(warp(vec2(wp.x * .40, (wp.y + e.x*.0021) * 4.2), .55)) * 2.05);
      hx = abs(hx - .5) * 2.; hy = abs(hy - .5) * 2.;
      vec3 Nw = normalize(Nb + vec3((hx - band) * .85, (hy - band) * .85, 0.));

      // Real boards are lower contrast than the first instinct: a wide dark-to
      // -light sweep reads as charring, not as timber.
      vec3 lightWood = toLinear(vec3(.62, .45, .28));
      vec3 darkWood  = toLinear(vec3(.40, .26, .145));
      // A board is mostly one tone with the grain reading as a whisper over it.
      vec3 alb = mix(darkWood, lightWood, smoothstep(.30, .70, band) * .55 + .22);
      alb *= .95 + .09 * pore;
      alb = mix(alb, toLinear(tcol), talpha * .6);

      float ndv = max(dot(Nw, V), 1e-3);
      float ndl = max(dot(Nw, Ldir), 0.);
      vec3 H = normalize(Ldir + V);
      // Anisotropic along the grain: a varnished board's highlight is a streak.
      float aa = .34 * .34;
      float D = D_GGXaniso(max(dot(Nw, H), 0.), dot(vec3(1.,0.,0.), H), dot(vec3(0.,1.,0.), H), aa * 4., aa);
      vec3 F = F_Schlick(vec3(.045), max(dot(H, V), 0.));
      vec3 wo = alb * (.16 + .95 * ndl);
      wo += F * D * V_SmithGGX(ndv, ndl, aa) * ndl * 5.5 * uSpec;
      wo += alb * pow(1. - ndv, 3.5) * .35;
      plasma = toSrgb(tonemap(wo));
    } else if (uMat < 5.5) {
      // ── stone ─────────────────────────────────────────────────────────
      vec2 sq = warp(p * .022, .9);
      float body = fbm(sq) * .62 + fbm(sq * 3.7) * .26 + fbm(sq * 11.) * .12;
      float fleck = hash(floor(p * 2.2));
      float vein = smoothstep(.52, .58, fbm(sq * .55 + 7.1));
      float h0 = body + (fleck - .5) * .35;
      float hx = fbm(warp((p + vec2(1.6, 0.)) * .022, .9)) + (hash(floor((p + vec2(1.6,0.)) * 2.2)) - .5) * .35;
      float hy = fbm(warp((p + vec2(0., 1.6)) * .022, .9)) + (hash(floor((p + vec2(0.,1.6)) * 2.2)) - .5) * .35;
      vec3 Ns = normalize(Nb + vec3((hx - h0) * 3.4, (hy - h0) * 3.4, 0.));

      vec3 alb = mix(toLinear(vec3(.24, .235, .25)), toLinear(vec3(.55, .545, .55)), body);
      alb = mix(alb, toLinear(vec3(.70, .69, .67)), vein * .5);
      alb *= .92 + (fleck - .5) * .18;
      alb = mix(alb, toLinear(tcol), talpha * .6);

      float ndv = max(dot(Ns, V), 1e-3);
      float ndl = max(dot(Ns, Ldir), 0.);
      vec3 H = normalize(Ldir + V);
      float aa = .72 * .72;                             // stone is rough
      vec3 F = F_Schlick(vec3(.035), max(dot(H, V), 0.));
      vec3 st = alb * (.20 + .95 * ndl);
      st += F * D_GGX(max(dot(Ns, H), 0.), aa) * V_SmithGGX(ndv, ndl, aa) * ndl * 3.2 * uSpec;
      st += alb * pow(1. - ndv, 4.) * .25;              // dusty edge
      plasma = toSrgb(tonemap(st));
    } else {
      // ── cloud ─────────────────────────────────────────────────────────
      // The one volume. The SDF is the boundary, density is noise inside it,
      // and the light is marched rather than dotted: transmittance by
      // Beer-Lambert, scattering by Henyey-Greenstein. A lambert cloud looks
      // painted; a marched one looks lit from a direction.
      // Bounded tight to the silhouette, which the edge displacement has
      // already made billowy — the panel's outline is the cloud's outline. The
      // interior is dense, so it reads as a thing made of cloud rather than as
      // haze lying over a rectangle.
      float inside = smoothstep(-1., 9., sd);
      vec2 dq = warp(p * .0058 + vec2(uTime * .010, uTime * .004), 1.15);
      float base = fbm(dq) * .58 + fbm(dq * 2.7) * .28 + fbm(dq * 6.9) * .14;
      float dens = clamp(inside * (.55 + base * 1.15) - .12, 0., 1.);

      // March toward the light and accumulate what it has to pass through.
      float shadow = 0.;
      vec2 step2 = normalize(Ldir.xy + vec2(1e-4)) * 16.;
      for (int i = 1; i <= 5; i++) {
        vec2 sp3 = p + step2 * float(i);
        float ins = smoothstep(-1., 9., sd + float(i) * 5.);
        vec2 q3 = warp(sp3 * .0058 + vec2(uTime * .010, uTime * .004), 1.15);
        shadow += clamp(ins * (.55 + fbm(q3) * 1.15) - .12, 0., 1.);
      }
      float transmit = exp(-shadow * .55);
      float cosT = dot(normalize(vec3(n, .6)), Ldir);
      float g = .45;
      float hg = (1. - g*g) / pow(1. + g*g - 2.*g*cosT, 1.5) * .0796;
      vec3 sunCol = toLinear(vec3(1., .96, .89));
      vec3 skyCol = toLinear(vec3(.42, .50, .64));
      vec3 cl = skyCol * (.35 + .65 * dens) + sunCol * transmit * (.55 + 5.5 * hg);
      cl = mix(cl, toLinear(tcol), talpha * .45);
      plasma = toSrgb(tonemap(cl));
      a = smoothstep(.04, .42, dens);   // density is the coverage, not the outline
    }

    col = mix(col, plasma, a);
    grain = 1. - a;   // grain is background-only; panels stay clean
  }
  // Keyed on viewport position, so a frame drawn for a taller region has the
  // same grain in its viewport band as the live frame that replaces it.
  col += (hash(p - uView.xy + uTime) - .5) * .025 * grain * uGrain;
  o = vec4(col, 1.);
}`;

return { maskFrag, tintFrag, blurFrag, bgFrag, compFrag };
}
