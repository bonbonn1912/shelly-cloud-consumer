import "dotenv/config";
import { format } from "date-fns"; // Zum Formatieren des Datums
import mysql from "mysql2/promise";


const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    port: 3306,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });


const devices = new Map([
  ["Hydromodul", "485519dbdffd"],
  ["Heizstab Trinkwasser", "485519da34bb"],
  ["Kondensatwanne", "485519db553b"],
  ["Heizstab Heizung", "485519dc6b69"],
  ["Verdichter", "485519dcccc5"],
  ["Heizstab 400V", "485519d6b0f3"],
]);

const login = async () => {
  const res = await fetch("https://api2.shelly.cloud/auth/login", {
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
      "content-type": "application/x-www-form-urlencoded",
      priority: "u=1, i",
      "sec-ch-ua":
        '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      Referer: "https://control.shelly.cloud/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
    body: process.env.BODY,
    method: "POST",
  });
  if (res.ok) {
    const data = await res.json();
    return { token: data.data.token, url: data.data.user_api_url };
  }
};

const getData = async (token, url, deviceId, date) => {
  const res = await fetch(
    `${url}/v2/statistics/power-consumption/em-3p?id=${deviceId}&channel=0&date_range=day&date_from=${date}%2000%3A00%3A00`,
    {
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
        authorization: "Bearer " + token,
        "if-none-match": "W/\"2f13-KYHyTZEb8wueTvZ/K7IEHNigbG4\"",
        "sec-ch-ua":
          '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        Referer: "https://control.shelly.cloud/",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
      body: null,
      method: "GET",
    }
  );

  if (res.ok) {
    const data = await res.json();
    return data;
  }
};

const parse = async (inputDate) => {
  const date = inputDate || format(new Date(), "yyyy-MM-dd"); // Standardmäßig heutiges Datum
  const { token, url } = await login();

  devices.forEach(async (value, key) => {
    const data = await getData(token, url, value, date);
    let phase1 = data.history[0];
    let phase2 = data.history[1];
    let phase3 = data.history[2];
    const totalReversed1 = sumReversed(phase1);
    const totalReversed2 = sumReversed(phase2);
    const totalReversed3 = sumReversed(phase3);
    const totalKwh = (
      (totalReversed1 + totalReversed2 + totalReversed3) / 1000
    ).toFixed(2);
    await insertOrUpdate(key, date, totalKwh);
    console.log(`${key} (${value}): ${totalKwh} kWh am ${date}`);
  });
  return null;
};

const sumReversed = (array) => {
  return array.reduce((total, obj) => {
    return total + (obj.reversed || 0);
  }, 0);
};
const insertOrUpdate = async (deviceName, date, totalKwh) => {
    console.log(deviceName)
    await db.execute(
      `INSERT INTO ShellyCloudUsage (name, date, total_kwh) 
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE total_kwh = ?, updatedAt = CURRENT_TIMESTAMP`,
      [deviceName, date, totalKwh, totalKwh]
    );
  };


const inputDate = process.argv[2]; 
parse(inputDate);
