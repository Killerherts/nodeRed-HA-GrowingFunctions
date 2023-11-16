//set=up any const we need
const ENTITY_IDS = {
    fanSensor: 'light.grow_side_1_exhuast',
    desiredTemp: 'input_number.side1_max_temp',
    roomTemp: 'sensor.grow_side1_table_temp',
    roomRH: 'sensor.grow_side1_table_humidity_rh',
    desiredRh: 'sensor.required_rh_for_desired_kpa_side_1'
};


let fanState = getHAState(ENTITY_IDS.fanSensor, 'state');
let desiredTemp = getHAState(ENTITY_IDS.desiredTemp, 'state');
let roomTemp = getHAState(ENTITY_IDS.roomTemp, 'state');
let roomRH = getHAState(ENTITY_IDS.roomRH, 'state');
let desiredRh = getHAState(ENTITY_IDS.desiredRh, 'state');
// Variables for easy adjustment
let debug = true;
const SPEED_RANGE = 255; // Maximum fan speed
const MAX_TEMP_DIFFERENCE = 10; // Maximum considered temperature difference

//Check all the variables
if (fanState != 'null') {
    let fanSpeed = getHAState(ENTITY_IDS.fanSensor, 'brightness');
    debugWarn("fanSpeed: " + fanSpeed);
}
debugWarn("fanState: " + fanState);
debugWarn("desiredTemp: " + desiredTemp);
debugWarn("roomTemp: " + roomTemp);
debugWarn("roomRH: " + roomRH);
debugWarn("desiredRh: " + desiredRh);


/**
 * Retrieves a specific property or attribute from a Home Assistant state object.
 * 
 * @param {string} entityId - The ID of the entity.
 * @param {string} [property='state'] - The property or attribute to retrieve (default is 'state').
 * @return The value of the specified property or attribute, or null if not found.
 */
function getHAState(entityId, property = 'state') {
    const homeAssistant = global.get('homeassistant');
    if (homeAssistant && homeAssistant.homeAssistant.states && homeAssistant.homeAssistant.states[entityId]) {
        const stateObj = homeAssistant.homeAssistant.states[entityId];
        if (property === 'state') {
            return stateObj.state;
        } else if (stateObj.attributes && stateObj.attributes.hasOwnProperty(property)) {
            // Check if the property is an attribute
            return stateObj.attributes[property];
        } else {
            node.warn(`Property or attribute '${property}' not found in state object: ${entityId}`);
            return null;
        }
    } else {
        node.warn(`State not found or global object is undefined: ${entityId}`);
        return null;
    }
}

// Modify all your node.warn calls to check the debug flag
function debugWarn(message) {
    if (debug) {
        node.warn(message);
    }
}
//build the payload for call service
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

function adjustFanSpeed() {
    // Ensure all required states are available
    if (roomTemp === null || desiredTemp === null || fanState === null) {
        debugWarn("Required state is missing.");
        return null; // Return null to indicate no action needed
    }

    // Convert string states to numbers for comparison
    let currentTemp = parseFloat(roomTemp);
    let targetTemp = parseFloat(desiredTemp);

    // If current temperature is at or below target and fan is on, turn off the fan
    if (currentTemp <= targetTemp && fanState == 'on') {
        debugWarn("Current temperature is at or below target. Turning off the fan.");
        return buildPayload('turn_off', 'light', ENTITY_IDS.fanSensor);
    }

    // If fan is off and temperature is above target, turn it on
    if (fanState === 'off' && currentTemp > targetTemp) {
        debugWarn("Fan is off and temperature is above target. Turning it on.");
        let initialSpeed = calculateInitialFanSpeed(currentTemp, targetTemp);
        return setFanSpeed(initialSpeed);
    }

    // If fan is already off and temperature is at or below target, do nothing
    if (fanState === 'off' && currentTemp <= targetTemp) {
        debugWarn("Fan is off and temperature is at or below target. No action needed.");
        return null;
    }

    // Calculate the difference between current and desired temperature
    let tempDifference = currentTemp - targetTemp;

    // Map the temperature difference to fan speed
    let speed = Math.min(Math.round((tempDifference / MAX_TEMP_DIFFERENCE) * SPEED_RANGE), SPEED_RANGE);

    // Set the fan speed
    return setFanSpeed(speed);
}

function calculateInitialFanSpeed(currentTemp, targetTemp) {
    // Implement your logic to calculate the initial fan speed
    // For example, you might want to start with a moderate speed
    // and then adjust based on the temperature difference
    let tempDifference = Math.max(currentTemp - targetTemp, 0);
    return Math.min(Math.round((tempDifference / MAX_TEMP_DIFFERENCE) * SPEED_RANGE), SPEED_RANGE);
}

/**
 * Prepares the fan speed setting payload.
 * @param {number} speed - Fan speed value (0 to 255).
 * @return The message payload for the next node.
 */
function setFanSpeed(speed) {
    // Assuming the speed is set by adjusting the brightness of the fan light entity
    let data = { brightness: speed };
    let payload = buildPayload('turn_on', 'light', ENTITY_IDS.fanSensor, null, data);

    // Return the payload for the next node in the flow
    return payload;
}

// Call the adjustFanSpeed function and pass the result to the next node
return adjustFanSpeed();
