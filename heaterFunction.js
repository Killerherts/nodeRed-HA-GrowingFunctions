/**One thhing of note I use a traditional automation to update my
 * highest soil sensor. I find this is easy just to do through the gui
 */

// Constants for Home Assistant Entity IDs
const ENTITY_IDS = {
    heaterPumpSwitch: 'switch.heater_pump',
    minLightsOnTemp: 'input_number.min_lights_on_temp',
    minLightsOffTemp: 'input_number.min_lights_off_temp',
    roomTempSensor: 'sensor.room_temp',
    lightOnTime: 'input_datetime.light_on_time',
    darkHours: 'input_number.side_1_dark_hours',
};

const delta= 2;  //delta before turning on heater
const debug = true;


// For retrieving data:
let roomTempSensor = getHAState(ENTITY_IDS.roomTempSensor);
let minLightsOnTemp = getHAState(ENTITY_IDS.minLightsOnTemp);
let minLightsOffTemp = getHAState(ENTITY_IDS.minLightsOffTemp);
let heaterPumpSwitch = getHAState(ENTITY_IDS.heaterPumpSwitch);
let lightOnTime = getHAState(ENTITY_IDS.lightOnTime);
let darkHours = getHAState(ENTITY_IDS.darkHours);

/**
 * 
 * Nothing needs to be changed under this section unless your modifing 
 * the basic functionality or how the script works. 
 * Modifiy at your own risk
 * 
 */


// Function to retrieve state from Home Assistant
function getHAState(state) {
    // Check if the states object and the specific state exist
    if (global.get('homeassistant') && global.get('homeassistant').homeAssistant
        && global.get('homeassistant').homeAssistant.states
        && global.get('homeassistant').homeAssistant.states[state]) {
        return global.get('homeassistant').homeAssistant.states[state].state;
    } else {
        // Handle the case where the state or any parent object is undefined
        node.warn("State not found or global object is undefined: " + state);
        return null; // or you can throw an error or return a default value
    }
}

//check for null states
function checkForNullStates() {
    let nullStates = [];

    if (roomTempSensor === null) nullStates.push("RoomTempSensor");
    if (heaterPumpSwitch === null) nullStates.push("heaterPumpSwitch");
    if (minLightsOnTemp === null) nullStates.push("minLightsOnTemp");
    if (minLightsOffTemp === null) nullStates.push("minLightsOffTemp");
    if (lightOnTime === null) nullStates.push("lightOnTime");
    if (darkHours === null) nullStates.push("darkHours");
    return nullStates; // Returns an array of null state names, empty if none are null
}




// Enhanced logging for debugging
function logDebugData() {
    if (debug) {
        node.warn("Room Temp Sensor: " + roomTempSensor); //room temp
        node.warn("Heater Pump Switch: " + heaterPumpSwitch);
        node.warn("Min Lights On Temp: " + minLightsOnTemp);
        node.warn("Min Lights Off Temp: " + minLightsOffTemp);
        node.warn("Light On Time: " + lightOnTime);
        node.warn("Dark Hours: " + darkHours);
        node.warn("Is Lights On Time: " + checkLightsOnTime());
    }
}

//function to make logbook entries
function logbookMsg(message) {
    
    // Create a message object with the payload for the api-call-service node
    const logMessage = {
        payload: {
            service_domain: 'logbook',
            service: 'log',
            data: {
            entity_id: ENTITY_IDS.heaterPumpSwitch,
            name: "Heater Control System",
            message: message
            }
        }
    };

    return logMessage;
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

function checkLightsOnTime() {
    let currentTime = new Date();
    let currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

    // Convert lightOnTime and darkHours to minutes since midnight
    let [onHours, onMinutes] = lightOnTime.split(':').map(Number);
    let lightOnMinutes = onHours * 60 + onMinutes;
    let darkMinutes = darkHours * 60;

    // Calculate light off time in minutes since midnight
    let lightOffMinutes = lightOnMinutes + darkMinutes;

    // Adjust light off time for crossing midnight
    lightOffMinutes = lightOffMinutes % 1440;

    // Check if current time is within the lights on period
    if (lightOnMinutes <= lightOffMinutes) {
        // Scenario where light on and off times are within the same day
        return currentMinutes >= lightOnMinutes && currentMinutes < lightOffMinutes;
    } else {
        // Scenario where light on time is today and off time is tomorrow
        return currentMinutes >= lightOnMinutes || currentMinutes < lightOffMinutes;
    }
}


function decideHeaterAction(currentTemp, desiredTemp, heaterState) {
    if (currentTemp < desiredTemp - delta && heaterState === 'off') {
        return 'turn_on';
    } else if (currentTemp >= desiredTemp && heaterState === 'on') {
        return 'turn_off';
    }
    return null;
}
function generateLogMessage(type, details) {
    if (type === 'error') {
        return `ERROR: ${details} is null`;
    } else if (type === 'action') {
        const { action, currentTemp, desiredTemp } = details;
        if (action === 'turn_on') {
            return `Heater Turned On - Room Temp: ${currentTemp}, Desired Temp: ${desiredTemp}`;
        } else if (action === 'turn_off') {
            return `Heater Turned Off - Room Temp: ${currentTemp}, Desired Temp: ${desiredTemp}`;
        }
    }
    return 'No action required';
}

function processControlFlow() {
    const nullStates = checkForNullStates();
    let logOutput = null;

    if (nullStates.length > 0) {
        nullStates.forEach(state => {
            let errorMessage = generateLogMessage('error', state);
            logOutput = logbookMsg(errorMessage);
            let persistentError = buildPayload('create', 'persistent_notification', '', null, { message: errorMessage, title: 'Heating System Error'});
            node.send([null, persistentError]);
        });
        return null;
    }

    let desiredTemp = checkLightsOnTime() ? minLightsOnTemp : minLightsOffTemp;
    let action = decideHeaterAction(roomTempSensor, desiredTemp, heaterPumpSwitch);

    if (action) {
        let actionDetails = { action, currentTemp: roomTempSensor, desiredTemp };
        let actionMessage = generateLogMessage('action', actionDetails);
        logOutput = logbookMsg(actionMessage);
        let operateHeater = buildPayload(action, 'switch', ENTITY_IDS.heaterPumpSwitch);

        node.send([operateHeater, logOutput]);
    }
}
processControlFlow();
logDebugData();