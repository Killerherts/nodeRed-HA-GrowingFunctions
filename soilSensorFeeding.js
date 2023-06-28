// Constants
const SECONDS_IN_DAY = 24 * 60 * 60;
const MIN_IRRIGATION_FREQUENCY = 10 * 60; // 10 minutes in seconds
const DESIRED_MOISTURE = 42; // Desired moisture level in water content percentage
const P1_THRESHOLD = 4;
const P2_THRESHOLD = 3;

// Retrieve necessary data from Home Assistant
let generative = getHAState('input_boolean.generative_steering_side1') === 'on';
let flipToFlower = getHAState('input_boolean.flip_to_flower_side1') === 'on';
let lightOnTime = convertTime(getHAState('input_datetime.lights_on_time_side1'));
let soilMoisture = parseFloat(getHAState('sensor.soilsensor_moisture_wc'));
let lastSoilMoisture = parseFloat(getHAState('input_number.side_1_last_soil_moisture')) || 0;
let maintenancePhase = getHAState('input_boolean.side_1_maintaince_phase') === 'on';
let lastIrrigationTime = getLastIrrigationTime();

// Current time
let currentTime = getCurrentTime();

// Calculate parameters
let dryBackThreshold = DESIRED_MOISTURE - 3;
let lightOffTime = calculateLightOffTime(flipToFlower, lightOnTime);
let irrigationStart = calculateIrrigationStart(generative, lightOnTime);
let irrigationEnd = calculateIrrigationEnd(lightOffTime);
let timeSinceLastIrrigation = calculateTimeSinceLastIrrigation(getLastIrrigationTime());


let inIrrigationWindow = checkInIrrigationWindow(currentTime, irrigationStart, irrigationEnd);
let soilMoistureChange = calculateSoilMoistureChange(soilMoisture, lastSoilMoisture);

// Function to convert time
function convertTime(timeString) {
    let time;
    let isUtc = false;

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
    return parseInt(hours * 60 * 60) + parseInt(minutes * 60) + parseInt(seconds);
}

// Function to retrieve state from Home Assistant
function getHAState(state) {
    return global.get('homeassistant').homeAssistant.states[state].state;
}

// Function to retrieve last irrigation time
function getLastIrrigationTime() {
    let lastIrrigationDate = new Date(getHAState('switch.side_1_feeder_pump').last_changed);
    return lastIrrigationDate.getSeconds() + (60 * (lastIrrigationDate.getMinutes() + 60 * lastIrrigationDate.getHours()));
}


// Function to get current time in seconds
function getCurrentTime() {
    const now = new Date();
    return now.getSeconds() + (60 * (now.getMinutes() + 60 * now.getHours()));
}


// Function to calculate light off time
function calculateLightOffTime(flipToFlower, lightOnTime) {
    return flipToFlower ? lightOnTime + 12 * 60 * 60 : lightOnTime + 18 * 60 * 60;
}

// Function to calculate irrigation start time
function calculateIrrigationStart(generative, lightOnTime) {
    return generative ? lightOnTime + 2 * 60 * 60 : lightOnTime + 60 * 60;
}

// Function to calculate irrigation end time
function calculateIrrigationEnd(lightOffTime) {
    return (lightOffTime - 60 * 60) % SECONDS_IN_DAY;
}

// Function to calculate time since last irrigation
function calculateTimeSinceLastIrrigation(lastIrrigationTime) {
    if (currentTime < lastIrrigationTime) { // Passed midnight since last irrigation
        return (SECONDS_IN_DAY - lastIrrigationTime) + currentTime;
    } else {
        return currentTime - lastIrrigationTime;
    }
}

// Function to check if current time is in irrigation window
function checkInIrrigationWindow(currentTime, irrigationStart, irrigationEnd) {
    if (irrigationStart > irrigationEnd) {
        return currentTime >= irrigationStart || currentTime <= irrigationEnd;
    } else {
        return currentTime >= irrigationStart && currentTime <= irrigationEnd;
    }
}

// Function to calculate soil moisture change
function calculateSoilMoistureChange(soilMoisture, lastSoilMoisture) {
    return soilMoisture - lastSoilMoisture;
}

// Function to log debug data
function logDebugData() {
    node.warn("inIrrigationWindow: " + inIrrigationWindow);
    node.warn("Generative: " + generative);
    node.warn("Flip to flower: " + flipToFlower);
    node.warn("Soil moisture: " + soilMoisture);
    node.warn("Last soil moisture: " + lastSoilMoisture);
    node.warn("Current time: " + currentTime);
    node.warn("Irrigation start time: " + irrigationStart);
    node.warn("Irrigation end time: " + irrigationEnd);
}

// Process control flow
function processControlFlow() {
    if (timeSinceLastIrrigation < MIN_IRRIGATION_FREQUENCY) {
        node.warn(`Last irrigation was less than ${MIN_IRRIGATION_FREQUENCY / 60} minutes ago. Not performing a check now.`);
        return [null, null, null];
    }

    if (inIrrigationWindow) {
        if (soilMoistureChange < P1_THRESHOLD && !maintenancePhase) {
            node.warn(`Soil moisture didn't raise more than ${P1_THRESHOLD}%. Moving to phase 1.`);
            return [{ payload: "feed" }, null, null];
        } else if (soilMoistureChange < P2_THRESHOLD && maintenancePhase) {
            node.warn(`Soil moisture dropped by more than ${P2_THRESHOLD}%. Moving to phase 2.`);
            return [null, { payload: "feed" }, null];
        }
    } else {
        node.warn(`Outside of irrigation window or soil moisture within the desired range. Moving to phase 3.`);
        return [null, null, { payload: "reset" }];
    }
}

//run
//logDebugData();
return processControlFlow();
