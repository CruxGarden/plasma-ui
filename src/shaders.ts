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
uniform vec2 uRes; uniform float uScale, uTime, uGoo, uEnergy, uLight, uMouseAmt, uDropR, uAmbient, uScroll, uVisc, uFlow;
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
    vec2 home = vec2(uRes.x*.88, uRes.y*.74);
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
  vec2 v = (p - vec2(0., uScroll))/uRes - .5;
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
    float sc = max(uRes.x / uImgRes.x, uRes.y / uImgRes.y);
    vec2 uv = (q - .5*uRes) / (uImgRes * sc) + .5;
    o = vec4(texture(uImg, clamp(uv, 0., 1.)).rgb, 1.);
    return;
  }
  o = vec4(bg(bp), 1.);
}`;

/** Pass 3: smoothed outline and plasma shading over the background textures. */
const compFrag = `#version 300 es
${common}
uniform sampler2D uH, uS, uTint, uBg, uBgM, uBgH, uFrost;
uniform float uRefract, uDisp, uRim, uRimMode, uRimWidth, uSpec, uHair;
uniform vec3 uRimColor;
out vec4 o;

vec3 pal(float t){ return .5 + .5*cos(6.2831*(t + vec3(0., .33, .67))); }
float H(vec2 uv){ return texture(uH, uv).r; }
vec2 uvAt(vec2 q){ return vec2(q.x, uRes.y - q.y) / uRes; }
// background seen through plasma with frost f: sharp, then medium, then heavy blur
vec3 seen(vec2 q, float f){
  vec2 u = uvAt(q);
  vec3 sharp = texture(uBg, u).rgb;
  if(f < .002) return sharp;
  vec3 soft = mix(texture(uBgM, u).rgb, texture(uBgH, u).rgb, smoothstep(.45, 1., f));
  return mix(sharp, soft, smoothstep(0., .45, f));
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
  col += pal(uTime*.03 + p.x/1400.) * .06 * smoothstep(.0, .45, hHere) * (1.+uEnergy);

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
    refr = mix(refr, vec3(dot(refr, vec3(.333))), .18) * mix(1.08, .9, uLight) + .03*(1.-uLight);
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

    vec3 plasma = refr;
    plasma += rimCol * fres * .45 * hl * uRim;
    plasma += vec3(1.) * spec * .75 * hl * uSpec;
    // faint shimmer across the body; fades out as the tint becomes opaque
    plasma += pal(uTime*.04 + p.y/900. + uEnergy*.3) * .05 * lift * (1.+uEnergy*2.) * hl * (1. - talpha);
    vec3 hairCol = uRimMode > .5 ? mix(vec3(1.), rimCol / 1.4, .6) : vec3(.9,.95,1.);
    plasma += hairCol * (1.-smoothstep(0., 1.6, abs(sd - .7))) * .4 * hl * uHair;

    float a = smoothstep(-.8, .8, sd);
    col = mix(col, plasma, a);
    grain = 1. - a;   // grain is background-only; panels stay clean
  }
  col += (hash(p + uTime) - .5) * .025 * grain;
  o = vec4(col, 1.);
}`;

return { maskFrag, tintFrag, blurFrag, bgFrag, compFrag };
}
