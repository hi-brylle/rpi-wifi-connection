# Dev README

This is the README for the developer (which is just me), meant for making me remember the workflow of publishing to NPM.
The [project README](https://github.com/hi-brylle/rpi-wifi-connection/tree/master/dist#readme) is inside `/dist`.

This repo is set up such that `/dist` contains nothing but the project README and its `package.json` file.
The contents of `/dist` are the ones getting published to NPM but are otherwise not tracked by Git because
code content will typically be generated using an `npm` command.

# The NPM publishing workflow

1. Make changes to code inside `/src`.
2. Compile changes using `npm run compile` making sure to run this at the top level of the project.
A successful compilation will update the distributable code inside `/dist`.
3. `cd` into `/dist`.
4. Update the package version using the appropriate `npm version patch|minor|major` command following semantic versioning rules.
5. Deploy distributable code to NPM using `npm publish`.
6. Commit changes to Git and push.