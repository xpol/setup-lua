const core = require("@actions/core")
const exec = require("@actions/exec")
const io = require("@actions/io")
const tc = require("@actions/tool-cache")



process.env["DEBUG"] = process.env["DEBUG"] || "setup-lua"
const debug = require("debug")("setup-lua")
const path = require("path")
const fs = require("fs")
const md5File = require('md5-file')
const os = require("os")

const SOURCE_DIRECTORY = path.join(process.cwd(), ".source/")
const INSTALL_PREFIX = path.join(process.cwd(), ".lua/")

const VERSION_ALIASES = {
  "5.1": "5.1.5",
  "5.2": "5.2.4",
  "5.3": "5.3.5",
  "5.4": "5.3.5",
  "luajit": "luajit-2.0.5",
  "luajit-2.0": "luajit-2.0.5",
  "luajit-2.1": "luajit-2.1.0-beta3",
}

const TARBALLS = {
  // need patch for 5.4
  // "5.4.1":              ["1d575faef1c907292edd79e7a2784d30", "https://www.lua.org/ftp/lua-5.4.1.tar.gz"],
  // "5.4.0":              ["dbf155764e5d433fc55ae80ea7060b60", "https://www.lua.org/ftp/lua-5.4.0.tar.gz"],
  "5.3.5":              ["4f4b4f323fd3514a68e0ab3da8ce3455", "https://www.lua.org/ftp/lua-5.3.5.tar.gz"],
  "5.3.4":              ["53a9c68bcc0eda58bdc2095ad5cdfc63", "https://www.lua.org/ftp/lua-5.3.4.tar.gz"],
  "5.3.3":              ["703f75caa4fdf4a911c1a72e67a27498", "https://www.lua.org/ftp/lua-5.3.3.tar.gz"],
  "5.3.2":              ["33278c2ab5ee3c1a875be8d55c1ca2a1", "https://www.lua.org/ftp/lua-5.3.2.tar.gz"],
  "5.3.1":              ["797adacada8d85761c079390ff1d9961", "https://www.lua.org/ftp/lua-5.3.1.tar.gz"],
  "5.3.0":              ["a1b0a7e92d0c85bbff7a8d27bf29f8af", "https://www.lua.org/ftp/lua-5.3.0.tar.gz"],
  "5.2.4":              ["913fdb32207046b273fdb17aad70be13", "https://www.lua.org/ftp/lua-5.2.4.tar.gz"],
  "5.2.3":              ["dc7f94ec6ff15c985d2d6ad0f1b35654", "https://www.lua.org/ftp/lua-5.2.3.tar.gz"],
  "5.2.2":              ["efbb645e897eae37cad4344ce8b0a614", "https://www.lua.org/ftp/lua-5.2.2.tar.gz"],
  "5.2.1":              ["ae08f641b45d737d12d30291a5e5f6e3", "https://www.lua.org/ftp/lua-5.2.1.tar.gz"],
  "5.2.0":              ["f1ea831f397214bae8a265995ab1a93e", "https://www.lua.org/ftp/lua-5.2.0.tar.gz"],
  "5.1.5":              ["2e115fe26e435e33b0d5c022e4490567", "https://www.lua.org/ftp/lua-5.1.5.tar.gz"],
  "5.1.4":              ["d0870f2de55d59c1c8419f36e8fac150", "https://www.lua.org/ftp/lua-5.1.4.tar.gz"],
  "5.1.3":              ["a70a8dfaa150e047866dc01a46272599", "https://www.lua.org/ftp/lua-5.1.3.tar.gz"],
  "5.1.2":              ["687ce4c2a1ddff18f1008490fdc4e5e0", "https://www.lua.org/ftp/lua-5.1.2.tar.gz"],
  "5.1.1":              ["22f4f912f20802c11006fe9b84d5c461", "https://www.lua.org/ftp/lua-5.1.1.tar.gz"],
  "5.1.0":              ["3e8dfe8be00a744cec2f9e766b2f2aee", "https://www.lua.org/ftp/lua-5.1.tar.gz"],

  "luajit-2.0.5":       ["48353202cbcacab84ee41a5a70ea0a2c", "https://luajit.org/download/LuaJIT-2.0.5.tar.gz"],
  "luajit-2.1.0-beta3": ["eae40bc29d06ee5e3078f9444fcea39b", "https://luajit.org/download/LuaJIT-2.1.0-beta3.tar.gz"],
  "luajit-2.1.0-beta2": ["fa14598d0d775a7ffefb138a606e0d7b", "https://luajit.org/download/LuaJIT-2.1.0-beta2.tar.gz"],
  "luajit-2.1.0-beta1": ["5a5bf71666e77cf6e7a1ae851127b834", "https://luajit.org/download/LuaJIT-2.1.0-beta1.tar.gz"],
  "luajit-2.0.4":       ["dd9c38307f2223a504cbfb96e477eca0", "https://luajit.org/download/LuaJIT-2.0.4.tar.gz"],
  "luajit-2.0.3":       ["f14e9104be513913810cd59c8c658dc0", "https://luajit.org/download/LuaJIT-2.0.3.tar.gz"],
  "luajit-2.0.2":       ["112dfb82548b03377fbefbba2e0e3a5b", "https://luajit.org/download/LuaJIT-2.0.2.tar.gz"],
  "luajit-2.0.1":       ["85e406e8829602988eb1233a82e29f1f", "https://luajit.org/download/LuaJIT-2.0.1.tar.gz"],
  "luajit-2.0.0":       ["97a2b87cc0490784f54b64cfb3b8f5ad", "https://luajit.org/download/LuaJIT-2.0.0.tar.gz"],
}

function walkSync(dir, filelist) {
  var path = path || require('path');
  var fs = fs || require('fs'),
      files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    var full = path.join(dir, file)
    if (fs.statSync(full).isDirectory()) {
      filelist = walkSync(full, filelist);
    }
    else {
      filelist.push(full);
    }
  });
  return filelist;
};

function showDirectory(d) {
  for (const i of walkSync(d)) {
    console.log(i)
  }
}

function mergeDirectory(source, dest) {
  let files = fs.readdirSync(source)
  for (const i of files) {
    const full = path.join(source, i)
    const to = path.join(dest, i)
    const stats = fs.lstatSync(full);
    if (stats.isDirectory()) {
      mergeDirectory(full, to)
    }
    else {
        io.mkdirP(path.dirname(to))
        io.cp(full, to)
      }
  }
}

function getTarball(version) {
  debug("getTarball %s", version)
  const v = VERSION_ALIASES[version] || version
  debug("maybe aliased version %s", v || "v is undefined...")
  if (!TARBALLS[v] || TARBALLS[v].length != 2) {
    throw RangeError("Unsupported lua version: " + version)
  }
  return [TARBALLS[v][1], TARBALLS[v][0]]
}

function getLuaVersion() {
  debug("getLuaVersion")
  const luaVersion = core.getInput('lua-version', { required: false })
  debug("version from input %s", luaVersion)
  return VERSION_ALIASES[luaVersion] || luaVersion || "5.1.5"
}

function getPlatform() {
  const platform = core.getInput('platfrom', { required: false });
  return platform || false;
}

async function download(url, hash) {
  debug("download url: %s, hash: %s", url, hash)
  const luaSourceTar = await tc.downloadTool(url)
  if (hash != md5File.sync(luaSourceTar)) {
    throw Error("MD5 mismatch, please check your network.");
  }
  return luaSourceTar
}

function tarballContentDirectory(version) {
  debug("tarballContentDirectory %s", version)
  if (version.startsWith("luajit")) {
    const luajitVersion = version.substr("luajit-".length)
    debug("LuaJIT version: %s", luajitVersion)
    return `LuaJIT-${luajitVersion}`
  }
  return `lua-${version}`
}

async function extractTarball(tarball, version) {
  debug("extractTarball %s", version)
  await io.mkdirP(SOURCE_DIRECTORY)
  debug("made source directory")
  await exec.exec(`cmake -E tar xzf "${tarball}"`, undefined, {
    cwd: SOURCE_DIRECTORY
  })
  debug("executed cmake -E tar xzf")
  showDirectory(SOURCE_DIRECTORY)
  const dir = tarballContentDirectory(version)
  debug("tarball content directory: %s", dir)
  return path.join(SOURCE_DIRECTORY, dir)
}

async function downloadSource(luaVersion) {
  debug("downloadSource %s", luaVersion)
  const [url, hash] = getTarball(luaVersion)
  debug("tarball url: %s, hash: %s", url, hash)
  const tarball = await download(url, hash)
  return extractTarball(tarball, luaVersion)
}

async function installSystemDependencies() {
  debug("installSystemDependencies")
  if (process.platform == "linux") {
    return await exec.exec("sudo apt-get install -q libreadline-dev libncurses-dev", undefined, {
      env: {
        DEBIAN_FRONTEND: "noninteractive",
        TERM: "linux"
      }
    })
  }

  if (process.platform == "darwin") {
    return
  }

  if (process.platform == "win32") { // even Windows 64 bit.
    // No dependencies needs to be installed.
    return
  }
}

async function addCMakeBuildScripts(sourcePath, luaVersion) {
  if (luaVersion.indexOf("jit") > -1) {
    return;
  }
  debug("addCMakeBuildScripts %s, %s", sourcePath, luaVersion)
  fs.unlinkSync(path.join(sourcePath, "src", "luaconf.h"))
  debug("removed luaconf.h")
  mergeDirectory(path.join(__dirname, "patch", "shared"), sourcePath)
  debug("merged patch/shared with %s", sourcePath)
  const v = luaVersion.replace(/\.\d*$/,'')
  debug("v: %s", v)
  mergeDirectory(path.join(__dirname, "patch", "lua", v), sourcePath)
  console.log("VERSION: " + v)
  showDirectory(sourcePath)
}

async function buildAndInstall(sourcePath, platform) {
  debug("buildAndInstall %s, %s", sourcePath, platform)
  if (/jit/i.test(sourcePath)) {
    await buildAndInstallLuaJIT(sourcePath, platform)
  } else {
    await buildAndInstallLua5(sourcePath, platform)
  }
  core.addPath(path.join(INSTALL_PREFIX, "bin"));
}

async function buildAndInstallLuaJIT(sourcePath) {
  debug("buildAndInstallLuaJIT %s", sourcePath)
  let env
  if (process.platform == "darwin") {
    env = {
      MACOSX_DEPLOYMENT_TARGET: os.release().split('.').slice(0, 2).map(n => `0${n}`.substr(-2)).join('.'),
    }
  }
  await exec.exec(`make PREFIX=${INSTALL_PREFIX}`, undefined, { cwd: sourcePath, env })
  await exec.exec("sudo -E make install", undefined, { cwd: sourcePath })
  if (/beta/i.test(sourcePath)) {
    let version = path.parse(sourcePath).base
    if (!version) {
      throw new Error(`Unable to determine full beta binary name from source path: ${sourcePath}`)
    }
    await exec.exec("sudo -E ln -sf luajit-2.1.0-beta3 /usr/local/bin/luajit")
  }
}

async function buildAndInstallLua5(sourcePath, platform) {
  debug("buildAndInstallLua5 %s, %s", sourcePath, platform)
  if(platform){
    await exec.exec(`cmake -H"${sourcePath}" -Bbuild -DCMAKE_INSTALL_PREFIX=${INSTALL_PREFIX} -A${platform}`, undefined, {
      cwd: sourcePath
    })
  }
  else{
    await exec.exec(`cmake -H"${sourcePath}" -Bbuild -DCMAKE_INSTALL_PREFIX=${INSTALL_PREFIX}`, undefined, {
      cwd: sourcePath
    })
  }

  await exec.exec(`cmake --build build --config Release --target install`, undefined, {
    cwd: sourcePath
  })
}

async function main() {
  debug("main")
  await installSystemDependencies()
  debug("System dependencies installed")
  const luaVersion = getLuaVersion()
  debug("Got lua version: %s", luaVersion)
  const platform = getPlatform();
  debug("Got Platform: %s", platform)
  const sourcePath = await downloadSource(luaVersion)
  debug("Downloaded to: %s", sourcePath)
  await addCMakeBuildScripts(sourcePath, luaVersion)
  debug("Added cmake build scripts")
  await buildAndInstall(sourcePath, platform)
  debug("built and installed")
}

main().catch(err => {
  core.setFailed(`Failed to install Lua: ${err}`);
})
