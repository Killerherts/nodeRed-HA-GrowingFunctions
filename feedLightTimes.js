// HomeAssistant object
const d = global.get('homeassistant').homeAssistant;

// Convert states to boolean
let flipStarted = d.states["input_boolean.flip_to_flower_side1"].state === "on";
let generativeSteering = d.states["input_boolean.generative_steering_side1"].state === "on";

// Get other states
let numberOfFeeds = d.states["input_number.number_of_feeds_side1"].state;
let startFeedTime = d.states["input_datetime.lights_on_time_side1"].state;
let switchState = d.states["switch.veg_light_switch"]?.state;

// Define variables
let currentTime = "";
let lightOffTime = "";
let lightOnTime = "";

// Function to convert a time string to seconds
function convertTime(timeString) {
    let time;
    let isUtc = false;

    // When no argument is provided, use the current time
    if (!timeString) {
        time = new Date();
    } else {
        time = new Date(timeString);
        isUtc = timeString.includes("Z") || timeString.includes("+") || timeString.includes("-");
        if (isNaN(time.getTime())) {
            time = new Date("1970-01-01T" + timeString + "Z");
            isUtc = true;
        }
    }

    let hours, minutes, seconds;
    if (isUtc) {
        hours = time.getUTCHours();
        minutes = time.getUTCMinutes();
        seconds = time.getUTCSeconds();
    } else {
        hours = time.getHours();
        minutes = time.getMinutes();
        seconds = time.getSeconds();
    }
    currentTime = hours * 60 * 60 + minutes * 60 + seconds;
    return hours * 60 * 60 + minutes * 60 + seconds;
}

// Function to calculate feed times
function calculateFeedTime(flipStarted, numberOfFeeds, startFeedTime, generativeSteering) {
    let lastFeedTime = 0;
    let startFeedTimeSeconds = convertTime(startFeedTime);
    lightOnTime = convertTime(startFeedTime);

    // If flip started, adjust feed and light times accordingly
    if (flipStarted) {
        lastFeedTime = startFeedTimeSeconds + (12 * 60 * 60);
        lightOffTime = lastFeedTime;
    } else {
        lastFeedTime = startFeedTimeSeconds + (18 * 60 * 60);
        lightOffTime = lastFeedTime;
    }

    // If generative steering is on, adjust feed times
    if (generativeSteering) {
        startFeedTimeSeconds += 1.5 * 60 * 60;
        lastFeedTime -= 3 * 60 * 60;
    } else {
        startFeedTimeSeconds += 1 * 60 * 60;
        lastFeedTime -= 1 * 60 * 60;
    }

    let feedTimes = [];
    let feedTime = 0;

    // Calculate feed times
    for (let i = 0; i < numberOfFeeds; i++) {
        feedTime = startFeedTimeSeconds + i * Math.round((lastFeedTime - startFeedTimeSeconds) / (numberOfFeeds - 1));
        feedTime = feedTime % (24 * 60 * 60);

        let hours = Math.floor(feedTime / 3600);
        let minutes = Math.floor((feedTime % 3600) / 60);
        let seconds = feedTime % 60;

        hours = hours < 10 ? "0" + hours : hours;
        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        feedTimes.push(hours + ":" + minutes + ":" + seconds);
    }

    return feedTimes;
}

// Function to check if it's feed time
function checkFeedTime(feedTimes) {
    let currentTotalSeconds = convertTime();
    let numberOfFeeds = feedTimes.length;
    let lastFeedTime = context.get("lastFeedTime") || 0;

    // Loop over feed times and check if it's time to feed
    for (let i = 0; i < numberOfFeeds; i++) {
        let feedTimeSeconds = convertTime(feedTimes[i]);
        let timeDiffSeconds = Math.abs(currentTotalSeconds - feedTimeSeconds);

        if (timeDiffSeconds <= 30 && feedTimeSeconds !== lastFeedTime) {
            context.set("lastFeedTime", feedTimeSeconds);
            return "feed";
        }
    }

    return "no feed";
}

// Function to format feed times for display
function formatFeedTimes(feedTimes) {
    let formattedFeedTimes = feedTimes.map(feedTime => feedTime.toString());
    let table = formattedFeedTimes.join("\n");
    return table;
}

// Get feed times and formatted feed times
let feedTimes = calculateFeedTime(flipStarted, numberOfFeeds, startFeedTime, generativeSteering);
let formattedFeedTimes = formatFeedTimes(feedTimes);

// Check if it's time to feed
let feedAction = checkFeedTime(feedTimes);

// Check if it's time to turn the lights on or off
const currentTotalSeconds = convertTime();
if (switchState === "off") {
    if (lightOffTime < lightOnTime && currentTotalSeconds < lightOnTime && currentTotalSeconds < lightOffTime ||
        lightOffTime >= lightOnTime && currentTotalSeconds >= lightOnTime) {
        return [null, null, { payload: "turn_on" }];
    }
} else if (switchState === "on") {
    if (lightOffTime < lightOnTime && currentTotalSeconds > lightOffTime && currentTotalSeconds < lightOnTime ||
        lightOffTime >= lightOnTime && currentTotalSeconds > lightOffTime) {
        return [null, null, { payload: "turn_off" }];
    }
}

// Check if it's time to feed
if (feedAction === "feed") {
    return [{ payload: "feed" }, null, null];
} else {
    return [null, { payload: formattedFeedTimes }, null];
}
