const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const fetch = require("node-fetch");
const _mkdirp = require("mkdirp");

const readFile = promisify((file, cb) => fs.readFile(file, "utf-8", cb));
const writeFile = promisify((file, data, cb) =>
  fs.writeFile(file, data, "utf-8", cb)
);
const unlinkFile = promisify(fs.unlink);
const mkdirp = promisify(_mkdirp);

async function getYarnRcContent(cwd) {
  try {
    return await readFile(path.resolve(cwd, ".yarnrc"));
  } catch (e) {
    if (e.code === "ENOENT") {
      return "";
    }
    throw e;
  }
}

async function getPackageJson(cwd) {
  const packageJsonPath = path.resolve(cwd, "package.json");

  try {
    const pkgJsonContent = await readFile(packageJsonPath);
    const pkgJson = JSON.parse(pkgJsonContent);
    return pkgJson;
  } catch (e) {
    if (e.code === "ENOENT") {
      console.warn("Not a module: No package.json file found.");
      return {};
    }

    throw e;
  }
}

async function parseYarnRc(cwd, content) {
  const contentLines = content.split("\n").filter(line => !!line);
  const pkgJson = await getPackageJson(cwd);
  const useCjsExtension = pkgJson && pkgJson.type && pkgJson.type === "module";

  const yarnRc = {
    installedVersion: null,
    preferredDir: "./vendor/",
    extension: useCjsExtension ? "cjs" : "js",
    data: {
      "yarn-path": { value: "" },
      "disable-self-update-check": { value: "true" }
    },
    getYarnPath() {
      const yarnPath = this.data["yarn-path"].value.replace(/^"|"$/g, "");
      return path.resolve(yarnPath);
    },
    setVersion(version) {
      const existingPath = this.data["yarn-path"].value;
      if (existingPath) {
        this.data["yarn-path"].value = existingPath
          .replace(this.installedVersion, version)
          .replace(/\.c?js"$/, `.${this.extension}"`);
      } else {
        const dir = this.preferredDir;
        const ext = this.extension;
        this.data["yarn-path"].value = `"${dir}yarn-${version}.${ext}"`;
      }
    },
    async save() {
      let newContent = content;

      for (const [key, { originalFullLine, value }] of Object.entries(
        this.data
      )) {
        const newLine = `${key} ${value}`;

        if (originalFullLine) {
          newContent = newContent.replace(originalFullLine, newLine);
        } else {
          if (newContent === "") {
            newContent = newLine + "\n";
          } else {
            newContent += newLine + "\n";
          }
        }
      }

      await writeFile(path.resolve(cwd, ".yarnrc"), newContent);
    }
  };

  for (const line of contentLines) {
    let firstSpace = line.indexOf(" ");

    if (firstSpace !== -1) {
      const key = line.substr(0, firstSpace);
      const value = line.substr(firstSpace + 1);

      yarnRc.data[key] = {
        value,
        originalFullLine: line
      };

      if (key === "yarn-path") {
        const matches = value.match(/"((\.\/)?(\w+\/)*)yarn-([0-9.]+)\.c?js"$/);

        if (matches) {
          yarnRc.preferredDir = matches[1];
          yarnRc.installedVersion = matches[4];
        }
      }
    }
  }

  return yarnRc;
}

async function getLatestYarnVersion() {
  const res = await fetch(
    "https://api.github.com/repos/yarnpkg/yarn/releases/latest"
  );
  const release = await res.json();

  const version = release.name.replace(/^v/, "");
  const asset = release.assets.find(asset => {
    return asset.name === `yarn-${version}.js`;
  });

  if (!asset) {
    throw new Error(
      "Could not find suitable asset for release " + release.name
    );
  }

  return {
    version,
    assetUrl: asset.browser_download_url
  };
}

module.exports = async function main(cwd) {
  const yarnRcContent = await getYarnRcContent(cwd);
  const yarnRc = await parseYarnRc(cwd, yarnRcContent);

  if (yarnRc.installedVersion) {
    console.log("Currently running yarn version %s", yarnRc.installedVersion);
    console.log("Checking for updates...");
  } else {
    console.log("No local yarn version found, downloading latest one.");
  }

  const { version: latestVersion, assetUrl } = await getLatestYarnVersion();

  console.log("Newest yarn version is", latestVersion);

  if (yarnRc.installedVersion) {
    if (yarnRc.installedVersion === latestVersion) {
      console.log("Already up to date.");
      return;
    }
  }

  console.log("Downloading new version...");

  const res = await fetch(assetUrl);

  if (!res.ok) {
    throw new Error("Failed to fetch asset: " + assetUrl);
  }

  const rawContent = await res.text();

  if (yarnRc.installedVersion) {
    await unlinkFile(yarnRc.getYarnPath());
  }

  yarnRc.setVersion(latestVersion);

  await mkdirp(path.dirname(yarnRc.getYarnPath()));
  await writeFile(yarnRc.getYarnPath(), rawContent);

  await yarnRc.save();

  console.log("Done.");
};
