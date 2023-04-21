// Import Home Assistant state data
const d = global.get('homeassistant').homeAssistant;

// Retrieve and process necessary state data
let flipStarted = d.states["input_boolean.has_flip_to_flower_started"].state === "on"; // Convert the state to a boolean
let numberOfFeeds = d.states["input_number.number_of_feeds_flower_area"].state;
let startFeedTime = d.states["input_datetime.lights_on_time"].state;
let generativeSteering = d.states["input_boolean.generative_steering_flower"].state === "on";
// Log relevant state data for debugging
console.log(startFeedTime, numberOfFeeds, flipStarted, generativeSteering);

// Calculate feed times using the state data
let feedTimes = calculateFeedTime(flipStarted, numberOfFeeds, startFeedTime, generativeSteering);
/**
 * Convert a time string to the number of seconds since midnight.
 * @param {string} timeString - The time string to convert.
 * @return {number} The time in seconds.
 */
function convertTime(timeString) {
    let time = new Date(timeString);
    let isUtc = timeString.includes("Z") || timeString.includes("+") || timeString.includes("-");

    if (isNaN(time.getTime())) {
        time = new Date("1970-01-01T" + timeString + "Z");
        isUtc = true;
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

    return hours * 60 * 60 + minutes * 60 + seconds;
}
/**
 * Calculate the feed times based on the given input parameters.
 * @param {boolean} flipStarted - Whether the flip to flower has started.
 * @param {number} numberOfFeeds - The number of feedings in the flower area.
 * @param {string} startFeedTime - The start time of the feedings.
 * @param {boolean} generativeSteering - Whether generative steering is enabled.
 * @return {string[]} An array of feed times as strings in the format "HH:mm:ss".
 */
function calculateFeedTime(flipStarted, numberOfFeeds, startFeedTime, generativeSteering) {
    let lastFeedTime = 0;
    let startFeedTimeSeconds = convertTime(startFeedTime);

    if (flipStarted) {
        lastFeedTime = startFeedTimeSeconds + (12 * 60 * 60);
    } else {
        lastFeedTime = startFeedTimeSeconds + (18 * 60 * 60);
    }

    if (generativeSteering) { // Add this condition
        startFeedTimeSeconds += 1.5 * 60 * 60;
        lastFeedTime -= 3 * 60 * 60;
    } else { // Add this else statement
        startFeedTimeSeconds += 1 * 60 * 60;
    }

    let feedTimes = [];
    let feedTime = 0;

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

/**
 * Check if it's time to feed based on the current time and feed times.
 * @param {string[]} feedTimes - An array of feed times as strings in the format "HH:mm:ss".
 * @return {string} "feed" if it's time to feed, otherwise "no feed".
 */

function checkFeedTime(feedTimes) {
    let currentTime = new Date();
    let currentHour = currentTime.getHours();
    let currentMinute = currentTime.getMinutes();
    let currentSecond = currentTime.getSeconds();
    let currentTotalSeconds = (currentHour * 60 * 60) + (currentMinute * 60) + currentSecond;

    console.log("Current time (seconds):", currentTotalSeconds);

    let numberOfFeeds = feedTimes.length;
    let lastFeedTime = context.get("lastFeedTime") || 0;

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

function formatFeedTimes(feedTimes) {
    let formattedFeedTimes = feedTimes.map(feedTime => feedTime.toString());
    let table = formattedFeedTimes.join("\n");
    return table;
}
// Format feed times for display and check if it's time to feed

let formattedFeedTimes = formatFeedTimes(feedTimes);
let feedAction = checkFeedTime(feedTimes);

// Set the node status and output based on whether it's time to feed
if (feedAction === "feed") {
    node.status({ fill: "green", shape: "dot", text: "Feed" });
    return [{ payload: "feed" }, null];
} else {
    node.status({ fill: "blue", shape: "dot", text: "No Feed" });
    return [null, { payload: formattedFeedTimes }];
}