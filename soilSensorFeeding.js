// Constants
const SECONDS_IN_DAY = 24 * 60 * 60;
const MIN_IRRIGATION_FREQUENCY = 10 * 60; // 10 minutes in seconds
const DESIRED_MOISTURE = 42; // Desired moisture level in water content percentage
const P1_THRESHOLD = 4;
const P2_THRESHOLD = 3;
const MAX_DELTA = 20;

// Retrieve necessary data from Home Assistant
let generative = getHAState('input_boolean.generative_steering_side1') === 'on';
let flipToFlower = getHAState('input_boolean.flip_to_flower_side1') === 'on';
let lightOnTime = convertTime(getHAState('input_datetime.lights_on_time_side1'));
let soilMoisture = parseFloat(getHAState('sensor.soilsensor_moisture_wc'));
let last2SoilMoistureReadings = getLast2SoilMoistureReadings();
let maintenancePhase = getHAState('input_boolean.side_1_maintaince_phase') === 'on';
let currentTime = getCurrentTime();

// Update the last2SoilMoistureReadings array
if (last2SoilMoistureReadings.length === 2) {
    last2SoilMoistureReadings.shift();
}
last2SoilMoistureReadings.push(soilMoisture);

// Calculate parameters
let dryBackThreshold = DESIRED_MOISTURE - 3;
let lightOffTime = calculateLightOffTime(flipToFlower, lightOnTime);
let irrigationStart = calculateIrrigationStart(generative, lightOnTime);
let irrigationEnd = calculateIrrigationEnd(lightOffTime);
let timeSinceLastIrrigation = calculateTimeSinceLastIrrigation();

let inIrrigationWindow = checkInIrrigationWindow(currentTime, irrigationStart, irrigationEnd);
let soilMoistureChange = calculateSoilMoistureChange(soilMoisture, last2SoilMoistureReadings[0]);


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



// Function to get current time in seconds
function getCurrentTime() {
    const now = new Date();
    return now.getSeconds() + (60 * (now.getMinutes() + 60 * now.getHours()));
}


// Function to calculate light off time
function calculateLightOffTime(flipToFlower, lightOnTime) {
    return flipToFlower ? lightOnTime + 12 * 60 * 60 : lightOnTime + 18 * 60 * 60;
}

// Function to calculate irrigation start time dynamically based on lights on time
function calculateIrrigationStart(generative, lightOnTime) {
    let irrigationStart = lightOnTime;

    if (generative) {
        irrigationStart += 2 * 60 * 60; // Add 2 hours for generative steering
    } else {
        // Use a default start time if generative is not enabled
        irrigationStart += 60 * 60; // Add 1 hour
    }

    return irrigationStart;
}

// Function to calculate irrigation end time dynamically based on light off time
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
    node.warn("Last 2 soil moisture: " + last2SoilMoistureReadings);
    node.warn("Current time: " + currentTime);
    node.warn("Irrigation start time: " + irrigationStart);
    node.warn("Irrigation end time: " + irrigationEnd);
}

// Process control flow
function processControlFlow() {
    // Calculate parameters
    //currentTime = getCurrentTime();
    let dryBackThreshold = DESIRED_MOISTURE - 3;
    let lightOffTime = calculateLightOffTime(flipToFlower, lightOnTime);
    let irrigationStart = calculateIrrigationStart(generative, lightOnTime);
    let irrigationEnd = calculateIrrigationEnd(lightOffTime);
    let timeSinceLastIrrigation = calculateTimeSinceLastIrrigation();
    
    let inIrrigationWindow = checkInIrrigationWindow(currentTime, irrigationStart, irrigationEnd);
    let soilMoistureChange = calculateSoilMoistureChange(soilMoisture, last2SoilMoistureReadings[0]);

    if (timeSinceLastIrrigation < MIN_IRRIGATION_FREQUENCY) {
        node.warn(`Last irrigation was less than ${MIN_IRRIGATION_FREQUENCY / 60} minutes ago. Not performing a check now.`);
        return [null, null, null];
    }

    if (Math.abs(soilMoistureChange) > MAX_DELTA) {
        node.warn(`Delta of soil moisture is greater than ${MAX_DELTA}%. Outputting to a new 4th return.`);
        last2SoilMoistureReadings.push(soilMoisture);
        if (last2SoilMoistureReadings.length > 2) {
            last2SoilMoistureReadings.shift();
        }
        return [null, null, null, { payload: "max_delta", array: last2SoilMoistureReadings }];
    }

    if (inIrrigationWindow) {
        if (soilMoistureChange < P1_THRESHOLD && !maintenancePhase) {
            node.warn(`Soil moisture didn't raise more than ${P1_THRESHOLD}%. Moving to phase 2.`);
            last2SoilMoistureReadings.push(soilMoisture);
            if (last2SoilMoistureReadings.length > 2) {
                last2SoilMoistureReadings.shift();
            }
            const value = JSON.stringify(last2SoilMoistureReadings);
            return [{ payload: "feed", array: last2SoilMoistureReadings }, null, null];
        } else if (soilMoistureChange < P2_THRESHOLD && maintenancePhase) {
            node.warn(`Soil moisture dropped by more than ${P2_THRESHOLD}%. Moving to phase 3.`);
            last2SoilMoistureReadings.push(soilMoisture);
            if (last2SoilMoistureReadings.length > 2) {
                last2SoilMoistureReadings.shift();
            }
            return [null, { payload: "feed", array: last2SoilMoistureReadings }, null];
        }
    } else {
        if (currentTime > irrigationEnd && currentTime < irrigationStart) {
            node.warn(`Outside of irrigation window or soil moisture within the desired range. Resetting.`);
            last2SoilMoistureReadings.push(soilMoisture);
            if (last2SoilMoistureReadings.length > 2) {
                last2SoilMoistureReadings.shift();
            }
            return [null, null, { payload: "reset" }];
        } else {
            node.warn(`Outside of irrigation window. Not resetting.`);
            return [null, null, null];
        }
    }
}


// Function to retrieve last 2 soil moisture readings and convert to an array of numbers
function getLast2SoilMoistureReadings() {
    let readingsStr = getHAState('input_text.side_1_last_2_soil_wc');
    let readingsArr = readingsStr.split(',').map(Number);

    // Check if any reading is NaN, if so replace it with current soil moisture
    for (let i = 0; i < readingsArr.length; i++) {
        if (isNaN(readingsArr[i])) {
            readingsArr[i] = soilMoisture;
        }
    }

    return readingsArr;
}

//run
//logDebugData();
// Run the debug function
//return processControlFlowDebug();
return processControlFlow();
