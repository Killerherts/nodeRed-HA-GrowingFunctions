// Constants
const SECONDS_IN_DAY = 24 * 60 * 60;
const MIN_IRRIGATION_FREQUENCY = 10 * 60; // 10 minutes in seconds
const DESIRED_MOISTURE = 42; // Desired moisture level in water content percentage
const P1_THRESHOLD = 2;
const P2_THRESHOLD = 5;
const MAX_DELTA = 20;

// Retrieve necessary data from Home Assistant
let generative = getHAState('input_boolean.generative_steering_side1') === 'on';
let flipToFlower = getHAState('input_boolean.flip_to_flower_side1') === 'on';
let lightOnTime = convertTime(getHAState('input_datetime.lights_on_time_side1'));
let soilMoisture = parseFloat(getHAState('sensor.soilsensor_moisture_wc'));
let last2SoilMoistureReadings = getLast2SoilMoistureReadings();
let maintenancePhase = getHAState('input_boolean.side_1_maintaince_phase') === 'on';
let currentTime = getCurrentTime();
let currentTimeUTC = getCurrentTimeUTC();
let timeSinceLastIrrigation;

// Calculate parameters
let dryBackThreshold = DESIRED_MOISTURE - 3;
let lightOffTime = calculateLightOffTime(flipToFlower, lightOnTime);
let irrigationStart = calculateIrrigationStart(generative, lightOnTime);
let irrigationEnd = calculateIrrigationEnd(lightOffTime);
let lastChangedTimeMs = new Date(global.get('homeassistant').homeAssistant.states['switch.side_1_feeder_pump'].last_changed).getTime();
let lastChanged = convert_epoch_to_utc_seconds(lastChangedTimeMs);
let inIrrigationWindow = checkInIrrigationWindow(currentTime, irrigationStart, irrigationEnd);
let soilMoistureChange = calculateSoilMoistureChange(soilMoisture, last2SoilMoistureReadings[1]);
node.warn(soilMoistureChange)
//node.warn('last changed time ' + lastChanged)
//node.warn('current time utc ' + currentTimeUTC)

if (lastChanged < currentTimeUTC) {
    timeSinceLastIrrigation = Math.floor(currentTimeUTC - lastChanged);
} else {
    timeSinceLastIrrigation = Math.floor((SECONDS_IN_DAY - lastChanged) + currentTimeUTC);
}


node.warn('time since last irrigation ' + timeSinceLastIrrigation);

// Function to get current time in UTC seconds
function getCurrentTimeUTC() {
    const now = new Date();
    const utcSeconds = (now.getUTCHours() * 3600) + (now.getUTCMinutes() * 60) + now.getUTCSeconds();
    return utcSeconds;
}


function convert_epoch_to_utc_seconds(epoch_ms) {
    const epoch_seconds = epoch_ms / 1000;
    const seconds_into_day_utc = Math.floor(epoch_seconds % SECONDS_IN_DAY);
    return seconds_into_day_utc;
}


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

// Checks if the last two readings are within 2 percent of the desired moisture
function checkLast2ReadingsCloseToDesired(desired, readings) {
    let closeToDesired = readings.every(reading => Math.abs(reading - desired) <= 2);
    return closeToDesired;
}

// Function to retrieve last 2 soil moisture readings and convert to an array of numbers
function getLast2SoilMoistureReadings() {
    let readingsStr = getHAState('input_text.side_1_last_2_soil_wc');
    let readingsArr;

    try {
        readingsArr = JSON.parse(readingsStr);  // Convert string back to array
    } catch (e) {
        node.warn("Failed to parse last 2 soil moisture readings: " + e);
        readingsArr = [soilMoisture, soilMoisture];  // Default value in case of error
    }

    // Check if any reading is NaN, if so replace it with current soil moisture
    for (let i = 0; i < readingsArr.length; i++) {
        if (isNaN(readingsArr[i])) {
            readingsArr[i] = soilMoisture;
        }
    }
    node.warn(readingsArr)
    return readingsArr;
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
    node.warn("last Irrigation Run " + lastChanged)
}


// Process control flow
function processControlFlow() {
    if (timeSinceLastIrrigation < MIN_IRRIGATION_FREQUENCY) {
        node.warn(`Last irrigation was less than ${MIN_IRRIGATION_FREQUENCY / 60} minutes ago. Not performing a check now.`);
        return [null, null, null, null, null];
    }

    if (Math.abs(soilMoistureChange) > MAX_DELTA) {
        node.warn(`Delta of soil moisture is greater than ${MAX_DELTA}%. Outputting to a new 4th return.`);
        return [null, null, null, null, { payload: JSON.stringify(last2SoilMoistureReadings) }];
    }

    if (inIrrigationWindow) {
        if (!maintenancePhase) {
            if (soilMoisture < DESIRED_MOISTURE && !checkLast2ReadingsCloseToDesired(DESIRED_MOISTURE, last2SoilMoistureReadings)) {
                last2SoilMoistureReadings.push(soilMoisture);
                if (last2SoilMoistureReadings.length > 2) {
                    last2SoilMoistureReadings.shift();
                }
                node.warn('P1 feed');
                return [{ payload: JSON.stringify(last2SoilMoistureReadings) }, null, null, null, null];
            } else if (checkLast2ReadingsCloseToDesired(DESIRED_MOISTURE, last2SoilMoistureReadings)) {
                // If last two readings are within 2 percent, switch the maintenancePhase to true
                node.warn('P2 Flip Switch');
                return [null, null, null, { payload: "Start P2" }, null];
            }
        }
        if (soilMoistureChange > P2_THRESHOLD && maintenancePhase) {
            last2SoilMoistureReadings.push(soilMoisture);
            if (last2SoilMoistureReadings.length > 2) {
                last2SoilMoistureReadings.shift();
            }
            node.warn('P2 feed');
            return [null, { payload: JSON.stringify(last2SoilMoistureReadings) }, null, null, null];
        }
    } else {
        // Handles the over midnight irrigation window scenario
        if ((irrigationStart < irrigationEnd && (currentTime > irrigationEnd || currentTime < irrigationStart)) ||
            (irrigationStart > irrigationEnd && !(currentTime > irrigationStart && currentTime < irrigationEnd))) {
            node.warn(`Outside of irrigation window. Resetting Maintenance Switch for New day.`);
            return [null, null, { payload: 'reset switch' }, null, null];
        } else {
            node.warn(`Soil Moisture within desired range`);
            return [null, null, null, null, null];
        }
    }
}

//run
//logDebugData();
// Run the debug function
//return processControlFlowDebug();
return processControlFlow();
