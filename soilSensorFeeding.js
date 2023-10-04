// Constants
const SECONDS_IN_DAY = 24 * 60 * 60;
const MIN_IRRIGATION_FREQUENCY = 6 * 60; // 10 minutes in seconds
const DESIRED_MOISTURE = 45; // Desired moisture level in water content percentage
const P1_THRESHOLD = 2;
const P2_THRESHOLD = 5;
const MAX_DELTA = 15;

// Set the debug flag
const debug ='true';

// Retrieve necessary data from Home Assistant
let generative = getHAState('input_boolean.side_2_generative_steering') === 'on';
let flipToFlower = getHAState('input_boolean.side2_flip_to_flower') === 'on';
let lightOnTime = convertTime(getHAState('input_datetime.side_2_lights_on_time'));
let soilMoisture = parseFloat(getHAState('sensor.soil_sesor_a1_moisture_wc'));
let maintenancePhase = getHAState('input_boolean.side_2_maintance_phase') === 'on';
let currentTime = getCurrentTime();
let currentTimeUTC = getCurrentTimeUTC();
let timeSinceLastIrrigation;

// Calculate parameters
let dryBackThreshold = DESIRED_MOISTURE - 3;
let lightOffTime = calculateLightOffTime(flipToFlower, lightOnTime);
let irrigationStart = calculateIrrigationStart(generative, lightOnTime);
let irrigationEnd = calculateIrrigationEnd(lightOffTime);
let lastChangedTimeMs = new Date(global.get('homeassistant').homeAssistant.states['switch.side_2_feed_pump_switch'].last_changed).getTime();
let lastChanged = convert_epoch_to_utc_seconds(lastChangedTimeMs);
let inIrrigationWindow = checkInIrrigationWindow(currentTime, irrigationStart, irrigationEnd);

if (lastChanged < currentTimeUTC) {
    timeSinceLastIrrigation = Math.floor(currentTimeUTC - lastChanged);
} else {
    timeSinceLastIrrigation = Math.floor((SECONDS_IN_DAY - lastChanged) + currentTimeUTC);
}


//node.warn('time since last irrigation ' + timeSinceLastIrrigation);

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

function logDebugData() {
    if (debug) {
        node.warn("inIrrigationWindow: " + inIrrigationWindow);
        node.warn("Generative: " + generative);
        node.warn("Flip to flower: " + flipToFlower);
        node.warn("Soil moisture: " + soilMoisture);
        node.warn("Current time: " + currentTime);
        node.warn("Irrigation start time: " + irrigationStart);
        node.warn("Irrigation end time: " + irrigationEnd);
        node.warn("last Irrigation Run " + lastChanged);
    }
}

// Modify all your node.warn calls to check the debug flag
function debugWarn(message) {
    if (debug) {
        node.warn(message);
    }
}


// Process control flow
// Process control flow
function logDebugData() {
    if (debug) {
        node.warn("inIrrigationWindow: " + inIrrigationWindow);
        node.warn("Generative: " + generative);
        node.warn("Flip to flower: " + flipToFlower);
        node.warn("Soil moisture: " + soilMoisture);
        node.warn("Current time: " + currentTime);
        node.warn("Irrigation start time: " + irrigationStart);
        node.warn("Irrigation end time: " + irrigationEnd);
        node.warn("last Irrigation Run " + lastChanged);
    }
}

// Modify all your node.warn calls to check the debug flag
function debugWarn(message) {
    if (debug) {
        node.warn(message);
    }
}

// Process control flow
function processControlFlow() {
    if (timeSinceLastIrrigation < MIN_IRRIGATION_FREQUENCY) {
        debugWarn(`Last irrigation was less than ${MIN_IRRIGATION_FREQUENCY / 60} minutes ago. Not performing a check now.`);
        return [null, null, null, null, null];
    }

    const moistureDifference = DESIRED_MOISTURE - soilMoisture;

    if (Math.abs(moistureDifference) > MAX_DELTA) {
        debugWarn(`Moisture difference is greater than ${MAX_DELTA}%. Outputting to a new 5th return.`);
        return [null, null, null, null, { payload: JSON.stringify(soilMoisture) }];
    }

    if (inIrrigationWindow) {
        if (!maintenancePhase) {
            if (moistureDifference > P1_THRESHOLD) {
                debugWarn('P1 feed');
                return [{ payload: soilMoisture.toString() }, null, null, null, null];
            } else if (Math.abs(moistureDifference) <= 2) {
                // If the current reading is within 2 percent of the desired moisture
                debugWarn('P2 Flip Switch');
                return [null, null, null, { payload: "Start P2" }, null];
            }
        }
        if (moistureDifference > P2_THRESHOLD && maintenancePhase) {
            debugWarn('P2 feed');
            return [null, { payload: soilMoisture.toString() }, null, null, null];
        }
    } else {
        // Handles the over midnight irrigation window scenario
        if ((irrigationStart < irrigationEnd && (currentTime > irrigationEnd || currentTime < irrigationStart)) ||
            (irrigationStart > irrigationEnd && !(currentTime > irrigationStart && currentTime < irrigationEnd))) {
            debugWarn(`Outside of irrigation window. Resetting Maintenance Switch for New day.`);
            return [null, null, { payload: 'reset switch' }, null, null];
        } else {
            debugWarn(`Soil Moisture within desired range`);
            return [null, null, null, null, null];
        }
    }
}

// Run the debug function if debug is enabled
if (debug) {
    logDebugData();
}

// Run the processControlFlow function
return processControlFlow();
