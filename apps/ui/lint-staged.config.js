export default {
  "*.{js,jsx,ts,tsx,mjs,cjs}": [
    "oxlint --type-aware --fix",
    "eslint --cache --fix -c eslint.remainder.config.mjs",
    "prettier --write"
  ],
  "*.{css,html,md,json,yml,yaml}": ["prettier --write"]
};
