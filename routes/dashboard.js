// routes/greeting.js
const express = require("express");
const { DateTime } = require("luxon");

const router = express.Router();

// Map country codes to timezones
const timezoneMap = {
  NG: "Africa/Lagos",
  US: "America/New_York",
  GB: "Europe/London",
  IN: "Asia/Kolkata",
  CA: "America/Toronto",
  DE: "Europe/Berlin",
  FR: "Europe/Paris",
  ZA: "Africa/Johannesburg",
  AU: "Australia/Sydney",
  KE: "Africa/Nairobi",
  // Add more as needed
};

function getGreetingByCountryCode(countryCode) {
  const timezone = timezoneMap[countryCode] || "UTC";
  const localTime = DateTime.now().setZone(timezone);
  const hour = localTime.hour;

  let greeting;
  if (hour >= 5 && hour < 12) {
    greeting = "Good morning";
  } else if (hour >= 12 && hour < 18) {
    greeting = "Good afternoon";
  } else {
    greeting = "Good evening";
  }

  return {
    greeting,
    localTime: localTime.toFormat("HH:mm"),
    timezone,
  };
}

router.get("/", (req, res) => {
  // req.user is set by the global JWT authentication middleware in server.js
  const { username, country } = req.user;
  if (!country) {
    return res.status(400).json({ success: false, error: "Country information is missing in JWT" });
  }
  const { greeting, localTime, timezone } = getGreetingByCountryCode(country);
  res.json({
    success: true,
    greeting,       // e.g., "Good morning"
    localTime,      // e.g., "09:45"
    timezone,       // e.g., "Africa/Lagos"
    username,       // e.g., "john_doe"
    country,        // e.g., "NG"
  });
});

module.exports = router;
