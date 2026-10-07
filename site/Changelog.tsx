import React from "react";
import releases from "./releases.json";

export const latestVersion = releases[0].version;

export function Changelog() {
  return (
    <section id="changelog" aria-labelledby="changelog-heading">
      <h2 id="changelog-heading">Changelog</h2>
      <p className="section-lede">
        What you can build with each release, what works better, and what to
        know before upgrading.
      </p>
      <div className="releases">
        {releases.map((release, index) => (
          <article
            className="release"
            key={release.version}
            aria-labelledby={`release-${release.version}`}
          >
            <div className="release-version">
              <a href={`#release-${release.version}`}>v{release.version}</a>
              {index === 0 && <span className="release-badge">Latest</span>}
            </div>
            <div>
              <h3 id={`release-${release.version}`}>{release.title}</h3>
              <p>{release.summary}</p>
              {release.groups.map((group) => (
                <div className="release-group" key={group.title}>
                  <h4>{group.title}</h4>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <ul
                className="release-links"
                aria-label={`Links for ${release.version}`}
              >
                {release.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
      <p className="note">
        Looking for an older release or implementation details?{" "}
        <a href="https://github.com/CruxGarden/plasma-ui/blob/main/CHANGELOG.md">
          Read the full release history on GitHub.
        </a>
      </p>
    </section>
  );
}
