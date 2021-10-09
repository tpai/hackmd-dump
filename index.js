require("dotenv").config();

const fs = require("fs");
const dns = require("dns").promises;
const isReachable = require("is-reachable");
const puppeteer = require("puppeteer");
const fetch = require("isomorphic-fetch");
const AWS = require("aws-sdk");
AWS.config.update({ region: "ap-southeast-1" });

const s3 = new AWS.S3();

const HACKMD_LOGIN_PAGE = "https://hackmd.io/login";
const HACKMD_BACKUP_LINK = "https://hackmd.io/exportAllNotes";
const COOKIE_NAME = "connect.sid";

const {
  NODE_ENV,
  CHROME_HOST,
  HEALTH_CHECK_URL,
  HACKMD_EMAIL,
  HACKMD_PASSWORD,
} = process.env;

const checkAlive = async (url) => {
  const isReached = await isReachable(url);
  if (!isReached) {
    return await checkAlive();
  }
  return true;
};

let page;
const app = async () => {
  let browser;
  try {
    console.log("Launch browser");
    if (NODE_ENV === "development") {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox"],
      });
    } else {
      console.log(`CHROME_HOST=${CHROME_HOST}`);

      const { address } = await dns.lookup(CHROME_HOST, {
        family: 4,
        hints: dns.ADDRCONFIG,
      });

      console.log(`IP_ADDRESS=${address}`);
      console.log("Check browser health...");
      const isAlive = await checkAlive(`http://${address}:9222`);
      if (!isAlive) {
        console.log("Browser is dead!");
        return;
      }

      browser = await puppeteer.connect({
        browserURL: `http://${address}:9222`,
      });
    }
    console.log(await browser.version());

    console.log(`Open page: ${HACKMD_LOGIN_PAGE}`);
    page = await browser.newPage();
    page.setDefaultNavigationTimeout(0);
    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36"
    );
    await page.goto(HACKMD_LOGIN_PAGE);

    const emailEle = await page.$('input[name="email"]');
    const passwordEle = await page.$('input[name="password"]');
    await emailEle.type(HACKMD_EMAIL);
    await passwordEle.type(HACKMD_PASSWORD);

    const submitEle = await page.$('input[type="submit"]');
    await submitEle.click();

    await page.waitForNavigation();

    const cookies = await page.cookies();
    const sessionId = cookies.find((cookie) => cookie.name === COOKIE_NAME)
      .value;

    const buffer = await fetch(HACKMD_BACKUP_LINK, {
      headers: {
        Cookie: `connect.sid=${sessionId};`,
      },
    }).then((res) => res.buffer());

    const filename = `${new Date().toISOString()}.zip`;

    if (NODE_ENV === "development") {
      fs.writeFileSync(filename, buffer);
    }

    return await new Promise((resolve) => {
      s3.putObject(
        {
          Bucket: "hackmd-bak",
          Key: filename,
          Body: buffer,
        },
        function (err, data) {
          resolve({ err, data });
        }
      );
    });
  } catch (err) {
    throw new Error(err);
  } finally {
    await page.close();
    console.log("Close page");
  }
};

if (NODE_ENV === "development") {
  (async function () {
    try {
      const data = await app();
      console.log(data);
    } catch (err) {
      console.log(err);
    }
  })();
}

const express = require("express");
const server = express();
const port = "3000";

server.get("/", async (_, res) => {
  try {
    const data = await app();
    console.log(data);
    if (HEALTH_CHECK_URL) {
      await isReachable(HEALTH_CHECK_URL);
    }
    res.status(200).send(JSON.stringify(data));
  } catch (err) {
    console.log(err);
    res.status(400).send(`${err}`);
  }
});

server.listen(port, () => {
  console.log(`Example app listening at http://0.0.0.0:${port}`);
});
