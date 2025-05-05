#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import readline from 'node:readline';

const args = process.argv.slice(2);
const usernameArg = args.find(arg => arg.startsWith('--username='));
const username = usernameArg ? usernameArg.split('=')[1] : 'Anonymous';

let currentDir = os.homedir();

console.log(`Welcome to the File Manager, ${username}!`);
printCurrentDir();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
});

rl.prompt();

rl.on('line', async (line) => {
  const input = line.trim();
  if (input === '') {
    rl.prompt();
    return;
  }

  const [command, ...params] = parseInput(input);

  try {
    switch (command) {
      case 'up':
        goUp();
        break;
      case 'cd':
        changeDirectory(params[0]);
        break;
      case 'ls':
        listDirectory();
        break;
      case 'cat':
        await readFile(params[0]);
        break;
      case 'add':
        createFile(params[0]);
        break;
      case 'mkdir':
        createDirectory(params[0]);
        break;
      case 'rn':
        renameFile(params[0], params[1]);
        break;
      case 'cp':
        await copyFile(params[0], params[1]);
        break;
      case 'mv':
        await moveFile(params[0], params[1]);
        break;
      case 'rm':
        removeFile(params[0]);
        break;
      case 'os':
        getOSInfo(params[0]);
        break;
      case 'hash':
        await calculateHash(params[0]);
        break;
      case 'compress':
        await compressFile(params[0], params[1]);
        break;
      case 'decompress':
        await decompressFile(params[0], params[1]);
        break;
      case '.exit':
        exitProgram();
        break;
      default:
        console.log('Invalid input');
    }
  } catch (error) {
    console.log('Operation failed');
  }

  printCurrentDir();
  rl.prompt();
}).on('close', () => {
  exitProgram();
});

function parseInput(input) {
  const regex = /(?:[^\s"]+|"[^"]*")+/g;
  return input.match(regex).map(arg => arg.replace(/^"|"$/g, ''));
}

function printCurrentDir() {
  console.log(`You are currently in ${currentDir}`);
}

function goUp() {
  const parentDir = path.dirname(currentDir);
  if (parentDir !== currentDir) {
    currentDir = parentDir;
  }
}

function changeDirectory(dir) {
  const newPath = path.resolve(currentDir, dir);
  if (fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
    currentDir = newPath;
  } else {
    console.log('Operation failed');
  }
}

function listDirectory() {
  const items = fs.readdirSync(currentDir, { withFileTypes: true });
  const directories = items.filter(item => item.isDirectory()).map(dir => ({ Name: dir.name, Type: 'directory' }));
  const files = items.filter(item => item.isFile()).map(file => ({ Name: file.name, Type: 'file' }));
  const list = [...directories, ...files].sort((a, b) => a.Name.localeCompare(b.Name));
  console.table(list);
}

async function readFile(filePath) {
  const fullPath = path.resolve(currentDir, filePath);
  const readStream = fs.createReadStream(fullPath, 'utf-8');
  readStream.on('data', chunk => process.stdout.write(chunk));
  await new Promise((resolve, reject) => {
    readStream.on('end', resolve);
    readStream.on('error', reject);
  });
}

function createFile(fileName) {
  const fullPath = path.resolve(currentDir, fileName);
  fs.writeFileSync(fullPath, '');
}

function createDirectory(dirName) {
  const fullPath = path.resolve(currentDir, dirName);
  fs.mkdirSync(fullPath);
}

function renameFile(oldPath, newName) {
  const oldFullPath = path.resolve(currentDir, oldPath);
  const newFullPath = path.resolve(path.dirname(oldFullPath), newName);
  fs.renameSync(oldFullPath, newFullPath);
}

async function copyFile(src, destDir) {
  const srcPath = path.resolve(currentDir, src);
  const destPath = path.resolve(currentDir, destDir, path.basename(src));
  const readStream = fs.createReadStream(srcPath);
  const writeStream = fs.createWriteStream(destPath);
  await new Promise((resolve, reject) => {
    readStream.pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

async function moveFile(src, destDir) {
  await copyFile(src, destDir);
  const srcPath = path.resolve(currentDir, src);
  fs.unlinkSync(srcPath);
}

function removeFile(filePath) {
  const fullPath = path.resolve(currentDir, filePath);
  fs.unlinkSync(fullPath);
}

function getOSInfo(flag) {
  switch (flag) {
    case '--EOL':
      console.log(JSON.stringify(os.EOL));
      break;
    case '--cpus':
      const cpus = os.cpus();
      console.log(`Total CPUs: ${cpus.length}`);
      cpus.forEach((cpu, index) => {
        console.log(`CPU ${index + 1}: ${cpu.model}, ${cpu.speed / 1000} GHz`);
      });
      break;
    case '--homedir':
      console.log(os.homedir());
      break;
    case '--username':
      console.log(os.userInfo().username);
      break;
    case '--architecture':
      console.log(process.arch);
      break;
    default:
      console.log('Invalid input');
  }
}

async function calculateHash(filePath) {
  const fullPath = path.resolve(currentDir, filePath);
  const hash = crypto.createHash('sha256');
  const readStream = fs.createReadStream(fullPath);
  await new Promise((resolve, reject) => {
    readStream.on('data', chunk => hash.update(chunk));
    readStream.on('end', () => {
      console.log(hash.digest('hex'));
      resolve();
    });
    readStream.on('error', reject);
  });
}

async function compressFile(src, dest) {
  const srcPath = path.resolve(currentDir, src);
  const destPath = path.resolve(currentDir, dest);
  const readStream = fs.createReadStream(srcPath);
  const writeStream = fs.createWriteStream(destPath);
  const brotli = zlib.createBrotliCompress();
  await new Promise((resolve, reject) => {
    readStream.pipe(brotli).pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

async function decompressFile(src, dest) {
  const srcPath = path.resolve(currentDir, src);
  const destPath = path.resolve(currentDir, dest);
  const readStream = fs.createReadStream(srcPath);
  const writeStream = fs.createWriteStream(destPath);
  const brotli = zlib.createBrotliDecompress();
  await new Promise((resolve, reject) => {
    readStream.pipe(brotli).pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

function exitProgram() {
  console.log(`Thank you for using File Manager, ${username}, goodbye!`);
  process.exit(0);
}
