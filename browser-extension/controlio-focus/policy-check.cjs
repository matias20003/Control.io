"use strict";

const assert = require("node:assert/strict");
const policy = require("./focus-policy.js");

assert.equal(policy.normalizeHandle("@Franco.Pisso"), "franco.pisso");
assert.equal(policy.normalizeHandle("usuario inválido"), null);

const handle = "francopisso";
const profile = `https://www.instagram.com/${handle}/`;
const story = `https://www.instagram.com/stories/${handle}/123/`;
const profileReels = `https://www.instagram.com/${handle}/reels/`;
const post = "https://www.instagram.com/p/ABC_123/";
const reel = "https://www.instagram.com/reel/REEL_123/";
const pluralReel = "https://www.instagram.com/reels/PLURAL_REEL_123/";
const prefixedPost =
  "https://www.instagram.com/francopisso/p/PREFIXED_123/";
const prefixedPluralReel =
  "https://www.instagram.com/francopisso/reels/PREFIXED_REEL_123/";
const otherPrefixedPost =
  "https://www.instagram.com/otra-persona/p/OTHER_123/";
const otherPrefixedPluralReel =
  "https://www.instagram.com/otra-persona/reels/OTHER_REEL_123/";

assert.equal(policy.isAllowedNavigation(profile, handle, []), true);
assert.equal(policy.isAllowedNavigation(story, handle, []), true);
assert.equal(policy.isAllowedNavigation(profileReels, handle, []), true);
assert.equal(policy.isAllowedNavigation(post, handle, []), false);
assert.equal(policy.isAllowedNavigation(post, handle, ["/p/ABC_123"]), true);
assert.equal(policy.isAllowedNavigation(reel, handle, ["/reel/REEL_123"]), true);
assert.equal(
  policy.isAllowedNavigation(pluralReel, handle, ["/reels/PLURAL_REEL_123"]),
  true
);
assert.equal(
  policy.isAllowedNavigation("https://www.instagram.com/otra-persona/", handle, []),
  false
);
assert.equal(
  policy.isAllowedNavigation("https://www.instagram.com/explore/", handle, []),
  false
);
assert.equal(policy.classifyLink(post, handle, []), "allow-content");
assert.equal(policy.classifyLink(prefixedPost, handle, []), "allow-content");
assert.equal(policy.classifyLink(pluralReel, handle, []), "allow-content");
assert.equal(
  policy.classifyLink(prefixedPluralReel, handle, []),
  "allow-content"
);
assert.equal(policy.classifyLink(otherPrefixedPost, handle, []), "block");
assert.equal(
  policy.classifyLink(otherPrefixedPluralReel, handle, []),
  "block"
);
assert.equal(
  policy.classifyLink("https://www.instagram.com/otra-persona/", handle, []),
  "block"
);

console.log("Control.io Focus policy checks passed.");
