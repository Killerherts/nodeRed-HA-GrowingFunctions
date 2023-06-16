// Get Home Assistant global object
const d = global.get('homeassistant').homeAssistant;

// Convert state values to boolean or numbers
let flipStarted = d.states["input_boolean.has_flip_to_flower_started"].state === "on"; // Convert the state to a boolean
let numberOfFeeds = d.states["input_number.number_of_feeds_flower_area"].state;
let startFeedTime = d.states["input_datetime.lights_on_time"].state;
let generativeSteering = d.states["input_boolean.generative_steering_flower"].state === "on";
let startFlipDate = d.states["input_datetime.side_2_flip_day"].state;
// Initialize variables
let currentTime = "";
let lightOffTime = "";
let lightOnTime = "";
// Get the state of the switch
let switchState = d.states["switch.600_rspec"]?.state;
//console.log(startFlipDate, startFeedTime, numberOfFeeds, flipStarted, generativeSteering);
let feedTimes = calculateFeedTime(flipStarted, numberOfFeeds, startFeedTime, generativeSteering, startFlipDate);

function getDaysSinceFlip(startFlipDate) {
    let today = new Date();
    let flipDay = new Date(startFlipDate);
    let timeDiff = Math.abs(today.getTime() - flipDay.getTime());
    let diffDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)); // get difference in days
    return diffDays;
}

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
    return parseInt(hours * 60 * 60) + parseInt(minutes * 60) + parseInt(seconds);
}

function calculateFeedTime(flipStarted, numberOfFeeds, startFeedTime, generativeSteering, startFlipDate) {
    let daysSinceFlip = flipStarted ? getDaysSinceFlip(startFlipDate) : 0;
    let reducedLightHours = Math.min(daysSinceFlip, 6); // limit the reduction to 6 hours
    let startFeedTimeSeconds = convertTime(startFeedTime);
    lightOnTime = startFeedTimeSeconds;
    let totalLightHours = 18 - reducedLightHours;
    let totalLightSeconds = totalLightHours * 60 * 60;

    let feedStartSeconds = startFeedTimeSeconds;
    let feedLightSeconds = totalLightSeconds;
    if (generativeSteering) {
        feedStartSeconds += 1.5 * 60 * 60;
        feedLightSeconds -= 3 * 60 * 60;
    } else {
        feedStartSeconds += 1 * 60 * 60;
        feedLightSeconds -= 1 * 60 * 60;
    }

    lightOffTime = (startFeedTimeSeconds + totalLightSeconds) % (24 * 60 * 60);
    let feedIntervalSeconds = feedLightSeconds / numberOfFeeds;

    // Calculate feed times
    let feedTimes = [];
    for (let i = 0; i < numberOfFeeds; i++) {
        let feedTime = feedStartSeconds + i * feedIntervalSeconds;
        feedTime = feedTime % (24 * 60 * 60);

        let hours = Math.floor(feedTime / 3600);
        let minutes = Math.floor((feedTime % 3600) / 60);
        let seconds = feedTime % 60;

        hours = hours < 10 ? "0" + hours : hours;
        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        feedTimes.push(hours + ":" + minutes + ":" + seconds);
    }
    feedTimes.push("\nLights Off Time " + Math.floor(parseInt(lightOffTime) / 3600) + ":" + ("0" + Math.floor((parseInt(lightOffTime) % 3600) / 60)).slice(-2));
    return feedTimes;
}


function checkFeedTime(feedTimes) {
    let currentTotalSeconds = convertTime();
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
let currentTotalSeconds = convertTime();

//console.log("Lights on: " + lightOnTime + " Lights Off: " + lightOffTime + " Current Seconds: " + currentTotalSeconds)

// Check if it's time to turn the lights on
if (switchState === "off") {
    const currentTotalSeconds = convertTime();
    if (parseInt(lightOffTime) < parseInt(lightOnTime)) {
        // Span across midnight, compare current time with lightsOn and lightsOff
        if (
            currentTotalSeconds > parseInt(lightOnTime) &&
            currentTotalSeconds < parseInt(lightOffTime)
        ) {
            // Turn on lights
            node.status({ fill: "green", shape: "dot", text: "Turn On" });
            msg.payload.lightAction = 'Turned On';
            console.log('Lights turned on. condit 1');
            return [null, null, { payload: "turn_on" }];
        }
    } else {
        // Same day comparison
        if (
            currentTotalSeconds >= parseInt(lightOnTime) &&
            !(currentTotalSeconds > parseInt(lightOffTime))
        ) {
            // Turn on lights
            node.status({ fill: "green", shape: "dot", text: "Turn On" });
            msg.payload.lightAction = 'Turned On';
            console.log('Lights turned on. condit 2');
            return [null, null, { payload: "turn_on" }];
        }
    }
}
// Check if it's time to turn the lights off
else if (switchState === "on") {
    const currentTotalSeconds = convertTime();
    if (parseInt(lightOffTime) < parseInt(lightOnTime)) {
        // Span across midnight, compare current time with lightsOn and lightsOff
        if (
            currentTotalSeconds > parseInt(lightOffTime) &&
            currentTotalSeconds < parseInt(lightOnTime)
        ) {
            // Turn off lights
            node.status({ fill: "red", shape: "dot", text: "Turn Off" });
            msg.payload.lightAction = 'Turned Off';
            console.log('Lights turned off.');
            return [null, null, { payload: "turn_off" }];
        }
    } else {
        // Same day comparison
        if (
            currentTotalSeconds > parseInt(lightOffTime)
        ) {
            // Turn off lights
            node.status({ fill: "red", shape: "dot", text: "Turn Off" });
            msg.payload.lightAction = 'Turned Off';
            console.log('Lights turned off.');
            return [null, null, { payload: "turn_off" }];
        }
    }
}


if (feedAction === "feed") {
    node.status({ fill: "yellow", shape: "dot", text: "Feed" });
    return [{ payload: "feed" }, null, null];
} else {
    node.status({ fill: "blue", shape: "dot", text: "No Feed" });
    return [null, { payload: formattedFeedTimes }, null];
}
