const d = global.get('homeassistant').homeAssistant;
let flipStarted = d.states["input_boolean.flip_to_flower_side1"].state === "on"; // Convert the state to a boolean
let numberOfFeeds = d.states["input_number.number_of_feeds_side1"].state;
let startFeedTime = d.states["input_datetime.lights_on_time_side1"].state;
let generativeSteering = d.states["input_boolean.generative_steering_side1"].state === "on";
let currentTime = "";
let lightOffTime = "";
let lightOnTime = "";

//console.log(startFeedTime, numberOfFeeds, flipStarted, generativeSteering);

let feedTimes = calculateFeedTime(flipStarted, numberOfFeeds, startFeedTime, generativeSteering);

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
    currentTime = hours * 60 * 60 + minutes * 60 + seconds;
    return hours * 60 * 60 + minutes * 60 + seconds;
}
function calculateFeedTime(flipStarted, numberOfFeeds, startFeedTime, generativeSteering) {
    let lastFeedTime = 0;
    let startFeedTimeSeconds = convertTime(startFeedTime);
    lightOnTime = convertTime(startFeedTime);
    if (flipStarted) {
        lastFeedTime = startFeedTimeSeconds + (12 * 60 * 60);
        lightOffTime = lastFeedTime
    } else {
        lastFeedTime = startFeedTimeSeconds + (18 * 60 * 60);
        lightOffTime = lastFeedTime
    }

    if (generativeSteering) { // Add this condition
        startFeedTimeSeconds += 1.5 * 60 * 60;
        lastFeedTime -= 3 * 60 * 60;
    } else { // Add this else statement
        startFeedTimeSeconds += 1 * 60 * 60;
        lastFeedTime -= 1 * 60 * 60;
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

function checkFeedTime(feedTimes) {
    currentTime = new Date();
    let currentHour = currentTime.getHours();
    let currentMinute = currentTime.getMinutes();
    let currentSecond = currentTime.getSeconds();
    let currentTotalSeconds = (currentHour * 60 * 60) + (currentMinute * 60) + currentSecond;

    // console.log("Current time (seconds):", currentTotalSeconds);

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

let formattedFeedTimes = formatFeedTimes(feedTimes);
let feedAction = checkFeedTime(feedTimes);

if (currentTime >= lightOnTime && d.states["switch.veg_light_switch"]?.state === "off") {
    node.status({ fill: "green", shape: "dot", text: "Turn On" });
    msg.payload.lightAction = 'Turned On';
    console.log('Lights turned on.');
    return [null, null, { payload: "turn_on" }];
}

if (currentTime >= lightOffTime && d.states["switch.veg_light_switch"]?.state === "on") {
    node.status({ fill: "red", shape: "dot", text: "Turn Off" });
    msg.payload.lightAction = 'Turned Off';
    console.log('Lights turned off.');
    return [null, null, { payload: "turn_off" }];
}
if (feedAction === "feed") {
    node.status({ fill: "yellow", shape: "dot", text: "Feed" });
    return [{ payload: "feed" }, null, null];
} else {
    node.status({ fill: "blue", shape: "dot", text: "No Feed" });
    return [null, { payload: formattedFeedTimes }, null];
}
