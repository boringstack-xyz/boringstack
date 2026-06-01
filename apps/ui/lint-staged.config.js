export default {
  "*.{js,jsx,ts,tsx,mjs,cjs}": ["eslint --cache --fix", "prettier --write"],
  "*.{css,html,md,json,yml,yaml}": ["prettier --write"]
};
