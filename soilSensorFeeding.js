/**One thhing of note I use a traditional automation to update my
 * highest soil sensor. I find this is easy just to do through the gui
 */

// Constants for Home Assistant Entity IDs
const ENTITY_IDS = {
    highestSoilSensor: 'input_number.highest_soil_sensor_value',
    generative: 'input_boolean.side_2_generative_steering',
    flipToFlower: 'input_boolean.side2_flip_to_flower',
    lightOnTime: 'input_datetime.side_2_lights_on_time',
    soilMoisture: 'sensor.soil_sesor_a1_moisture_wc',
    maintenancePhase: 'input_boolean.side_2_maintance_phase',
    feedPumpSwitch: 'switch.side_2_feed_pump_switch'
};

const MIN_IRRIGATION_FREQUENCY = 6 * 60; // 10 minutes in seconds
const DESIRED_MOISTURE = 46; // Desired moisture level in water content percentage
const P1_THRESHOLD = 2;
const P2_THRESHOLD = 5; //dryback % before sending a p2
const MAX_DELTA = 25; //max dryback overnight
const DELAY_FOR_P1_FEED = 25;  // in seconds
const DELAY_FOR_P2_FEED = 45;  // in seconds
const debug = true;
/**
 * 
 * Nothing needs to be changed under this section unless your modifing 
 * the basic functionality or how the script works. 
 * Modifiy at your own risk
 * 
 */

// For retrieving data:
let highestSoilsensorVal = getHAState(ENTITY_IDS.highestSoilSensor);
let generative = getHAState(ENTITY_IDS.generative);
let flipToFlower = getHAState(ENTITY_IDS.flipToFlower);
let lightOnTime = convertTimeToSecondsUTC(getHAState(ENTITY_IDS.lightOnTime));
let soilMoisture = parseFloat(getHAState(ENTITY_IDS.soilMoisture));
let maintenancePhase = getHAState(ENTITY_IDS.maintenancePhase);
let currentTime = getCurrentTime();
let currentTimeUTC = getCurrentTimeUTC();


// Calculate parameters
const SECONDS_IN_DAY = 24 * 60 * 60; 
let lightOffTime = calculateLightOffTime(flipToFlower, lightOnTime);
let irrigationStart = calculateIrrigationStart(generative, lightOnTime);
let irrigationEnd = calculateIrrigationEnd(lightOffTime);
let lastChangedTimeMs = new Date(global.get('homeassistant').homeAssistant.states[ENTITY_IDS.feedPumpSwitch].last_changed).getTime();
let lastChanged = convert_epoch_to_utc_seconds(lastChangedTimeMs);
let inIrrigationWindow = checkInIrrigationWindow(currentTime, irrigationStart, irrigationEnd);
let timeSinceLastIrrigation;


if (lastChanged < currentTimeUTC) {
    timeSinceLastIrrigation = Math.floor(currentTimeUTC - lastChanged);
} else {
    timeSinceLastIrrigation = Math.floor((SECONDS_IN_DAY - lastChanged) + currentTimeUTC);
}

function utcMsToLocalHHMMSS(utcMs) {
    var date = new Date(utcMs);
    return date.toLocaleTimeString('en-US', { hour12: false });
}

function toHHMMSS(timeSeconds) {
    const sec = parseInt(timeSeconds, 10); // convert value to number if it's string
    let hours = Math.floor(sec / 3600); // get hours
    let minutes = Math.floor((sec - (hours * 3600)) / 60); // get minutes
    let seconds = sec - (hours * 3600) - (minutes * 60); // get seconds

    // add 0 if value < 10; Example: 2 -> 02
    if (hours < 10) { hours = "0" + hours; }
    if (minutes < 10) { minutes = "0" + minutes; }
    if (seconds < 10) { seconds = "0" + seconds; }

    return hours + ':' + minutes + ':' + seconds; // Return is HH : MM : SS
}


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

function convertTimeToSecondsUTC(timeString) {
    // Split the time string by ':' to get hours, minutes, and seconds
    const parts = timeString.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);

    // Calculate the total number of seconds from midnight
    return hours * 3600 + minutes * 60 + seconds;
}

function convertUTCToLocalTime(utcMilliseconds) {
    // Create a new Date object from the UTC milliseconds
    const date = new Date(utcMilliseconds);

    // Options for toLocaleTimeString to output time in HH:MM:SS format
    const options = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false // Use 24-hour format
    };

    // Convert to local time string with specified options
    // @ts-ignore
    return date.toLocaleTimeString( 'en-US', options);
}

// Function to retrieve state from Home Assistant
function getHAState(state) {
    return global.get('homeassistant').homeAssistant.states[state].state;
}

/**
 * Constructs a payload for Home Assistant service calls.
 * 
 * @param {string} service - The service to be called (e.g., 'turn_on', 'turn_off').
 * @param {string} domain - The domain of the entity (e.g., 'switch', 'light').
 * @param {string} entity_id - The id of the entity to be acted upon.
 * @param {number} delay - The delay in seconds before the action is performed.
 * @param {object} data - Any additional data to be passed along with the service call.
 * @returns {object} - The constructed payload.
 */
function buildPayload(service, domain, entity_id, delay = null, data = {}) {
    let payload = {
        service: service,
        domain: domain,
        entity_id: entity_id,
        data: data
    };

    let message = {
        payload: payload
    };

    if (delay !== null) {
        message.delay = delay * 1000; // Convert seconds to milliseconds
    }

    return message;
}
// Whenever you want to build a payload in your processControlFlow function:
// const payload = buildPayload('turn_on', 'switch', 'switch.your_p1_feed_id', DELAY_FOR_P1_FEED);



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
    if (generative == "on") {
        irrigationStart = irrigationStart + (2 * 60 * 60); // Add 2 hours for generative steering
    } else {
        // Use a default start time if generative is not enabled
        irrigationStart = irrigationStart + (60 * 60); // Add 1 hour
    }
    return irrigationStart;
}

// Function to calculate irrigation end time dynamically based on light off time
function calculateIrrigationEnd(lightOffTime) {
    return (lightOffTime - 60 * 60) % SECONDS_IN_DAY;
}

function checkInIrrigationWindow(currentTime, irrigationStart, irrigationEnd) {
    if (irrigationStart < irrigationEnd) {
        // The irrigation window does not span midnight
        return currentTime >= irrigationStart && currentTime < irrigationEnd;
    } else {
        // The irrigation window spans midnight
        // currentTime must be either after irrigationStart on the same day or before irrigationEnd on the next day
        return currentTime >= irrigationStart || currentTime < irrigationEnd;
    }
}

// Enhanced logging for debugging
function logDebugData() {
    if (debug) {
        debugWarn("Is in irrigation window? " + inIrrigationWindow);
        node.warn("Generative: " + generative);
        debugWarn('Maintance Phase: '+ maintenancePhase)
        node.warn("Flip to flower: " + flipToFlower);
        node.warn("Soil moisture: " + soilMoisture);
        node.warn("last Irrigation Run " + utcMsToLocalHHMMSS(lastChangedTimeMs));
        node.warn("Highest Sensor Value: " + highestSoilsensorVal);
        // Additional logging to help with debugging
        node.warn("timeSinceLastIrrigation: " + toHHMMSS(timeSinceLastIrrigation));
        node.warn("Current Time: " + new Date(currentTime * 1000).toISOString().substr(11, 8));
        node.warn("Irrigation Start: " + new Date(irrigationStart * 1000).toISOString().substr(11, 8));
        node.warn("Irrigation End: " + new Date(irrigationEnd * 1000).toISOString().substr(11, 8));
    }
}


// Modify all your node.warn calls to check the debug flag
function debugWarn(message) {
    if (debug) {
        node.warn(message);
    }
}

function processControlFlow() {
    let turnOnOutput = null;
    let delayAndTurnOffOutput = null;
    let flipBooleanOutput = null;
    let setInputNumberOutput = null;

    if (timeSinceLastIrrigation < MIN_IRRIGATION_FREQUENCY) {
        debugWarn(`Last irrigation was less than ${MIN_IRRIGATION_FREQUENCY / 60} minutes ago. Not performing a check now.`);
        return [null, null, null, null];
    }

    //reset highest soil value sensor at beginging of lights on
    if (Math.abs(currentTimeUTC - lightOnTime) < 60) {
        setInputNumberOutput = buildPayload('set_value', 'input_number', ENTITY_IDS.highestSoilSensor, null, { value: 0 });  // Reset highestSoilSensor value to 0
        return setInputNumberOutput
    }
    const moistureDifference = DESIRED_MOISTURE - soilMoisture;

    if (Math.abs(moistureDifference) > MAX_DELTA) {
        debugWarn("Max Dryback Feeding");
        turnOnOutput = buildPayload('turn_on', 'switch', ENTITY_IDS.feedPumpSwitch);
        delayAndTurnOffOutput = buildPayload('turn_off', 'switch', ENTITY_IDS.feedPumpSwitch, DELAY_FOR_P2_FEED);
    } else if (inIrrigationWindow) {
        if (!maintenancePhase) {
            if (moistureDifference <= P1_THRESHOLD || highestSoilsensorVal >= DESIRED_MOISTURE) {
                debugWarn('P2 Flip Switch');
                flipBooleanOutput = buildPayload('turn_on', 'input_boolean', ENTITY_IDS.maintenancePhase);
            } else if (moistureDifference > P1_THRESHOLD) {
                debugWarn('P1 feed');
                turnOnOutput = buildPayload('turn_on', 'switch', ENTITY_IDS.feedPumpSwitch);
                delayAndTurnOffOutput = buildPayload('turn_off', 'switch', ENTITY_IDS.feedPumpSwitch, DELAY_FOR_P1_FEED);
            }
        } else if (moistureDifference > P2_THRESHOLD) {
            debugWarn('P2 feed');
            turnOnOutput = buildPayload('turn_on', 'switch', ENTITY_IDS.feedPumpSwitch);
            delayAndTurnOffOutput = buildPayload('turn_off', 'switch', ENTITY_IDS.feedPumpSwitch, DELAY_FOR_P2_FEED);
        }
    }
    if (!inIrrigationWindow && maintenancePhase != 'off') {
                debugWarn("Resetting Maintenance Switch");
                flipBooleanOutput = buildPayload('turn_off', 'input_boolean', ENTITY_IDS.maintenancePhase);
    }
    return [turnOnOutput, delayAndTurnOffOutput, flipBooleanOutput, setInputNumberOutput];
}

logDebugData()
// Run the processControlFlow function
return processControlFlow();
