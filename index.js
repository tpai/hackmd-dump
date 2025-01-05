require("dotenv").config();

const fs = require("fs");
const archiver = require('archiver');
const isReachable = require("is-reachable");
const fetch = require("isomorphic-fetch");
const { S3 } = require("@aws-sdk/client-s3");

const s3 = new S3({ region: "ap-southeast-1" });

const HACKMD_API_URL = "https://api.hackmd.io/v1";

const {
  NODE_ENV,
  HEALTH_CHECK_URL,
  HACKMD_API_TOKEN,
} = process.env;


const app = async () => {
  try {
    // define archiver
    const filename = `${new Date().toISOString()}.zip`;
    const output = fs.createWriteStream(filename);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', function() {
      console.log('Notes archived');
      fs.readFile(filename, (err, buffer) => {
        if (err) {
          console.error('Error reading file:', err);
          return;
        }
        console.log('Uploading file...');
        new Promise((resolve) => {
          s3.putObject(
            {
              Bucket: "hackmd-bak",
              Key: filename,
              Body: buffer,
            },
            (_, data) => {
              console.log('File uploaded');
              resolve(data);
            }
          );
        });
      });
    });
    archive.on('error', function(err) {
      throw err;
    });
    archive.pipe(output);

    console.log("Downloading notes...");
    const response = await fetch(`${HACKMD_API_URL}/notes`, {
      headers: {
        'Authorization': `Bearer ${HACKMD_API_TOKEN}`
      }
    });
    const data = await response.json();
    for (const note of data) {
      console.log(`${note.title}.md`);
      try {
        const noteResponse = await fetch(`${HACKMD_API_URL}/notes/${note.id}`, {
          headers: {
            'Authorization': `Bearer ${HACKMD_API_TOKEN}`
          }
        });
        const noteData = await noteResponse.json();
        archive.append(noteData.content, { name: `${note.title}.md` });
      } catch (e) {
        console.error(`Failed to process note ${note.title}:`, e);
      }
      await new Promise(resolve => setTimeout(resolve, 3500));
    }
    archive.finalize();
    console.log("Archiving notes...");
  } catch (err) {
    throw new Error(err);
  }
};

if (NODE_ENV === "development") {
  (async () => {
    try {
      await app();
    } catch (err) {
      console.error(err);
    }
  })();
}

const express = require("express");
const server = express();
const port = "3000";

server.get("/", async (_, res) => {
  try {
    await app();
    if (HEALTH_CHECK_URL) {
      await isReachable(HEALTH_CHECK_URL);
    }
    res.status(200).send({success: 1});
  } catch (err) {
    console.log(err);
    res.status(400).send(`${err}`);
  }
});

server.listen(port, () => {
  console.log(`Example app listening at http://0.0.0.0:${port}`);
});
