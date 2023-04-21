[
    {
        "id": "b86eedac7a3ba4c4",
        "type": "function",
        "z": "e9ac4911b30dde89",
        "name": "Calc Feed TIme",
        "func": "const d = global.get('homeassistant').homeAssistant;\nlet flipStarted = d.states[\"input_boolean.has_flip_to_flower_started\"].state === \"on\"; // Convert the state to a boolean\nlet numberOfFeeds = d.states[\"input_number.number_of_feeds_flower_area\"].state;\nlet startFeedTime = d.states[\"input_datetime.lights_on_time\"].state;\nlet generativeSteering = d.states[\"input_boolean.generative_steering_flower\"].state === \"on\";\n\nconsole.log(startFeedTime, numberOfFeeds, flipStarted, generativeSteering);\n\nlet feedTimes = calculateFeedTime(flipStarted, numberOfFeeds, startFeedTime, generativeSteering);\n\nfunction convertTime(timeString) {\n    let time = new Date(timeString);\n    let isUtc = timeString.includes(\"Z\") || timeString.includes(\"+\") || timeString.includes(\"-\");\n\n    if (isNaN(time.getTime())) {\n        time = new Date(\"1970-01-01T\" + timeString + \"Z\");\n        isUtc = true;\n    }\n\n    let hours, minutes, seconds;\n    if (isUtc) {\n        hours = time.getUTCHours();\n        minutes = time.getUTCMinutes();\n        seconds = time.getUTCSeconds();\n    } else {\n        hours = time.getHours();\n        minutes = time.getMinutes();\n        seconds = time.getSeconds();\n    }\n\n    return hours * 60 * 60 + minutes * 60 + seconds;\n}\nfunction calculateFeedTime(flipStarted, numberOfFeeds, startFeedTime, generativeSteering) {\n    let lastFeedTime = 0;\n    let startFeedTimeSeconds = convertTime(startFeedTime);\n\n    if (flipStarted) {\n        lastFeedTime = startFeedTimeSeconds + (12 * 60 * 60);\n    } else {\n        lastFeedTime = startFeedTimeSeconds + (18 * 60 * 60);\n    }\n\n    if (generativeSteering) { // Add this condition\n        startFeedTimeSeconds += 1.5 * 60 * 60;\n        lastFeedTime -= 3 * 60 * 60;\n    } else { // Add this else statement\n        startFeedTimeSeconds += 1 * 60 * 60;\n    }\n\n    let feedTimes = [];\n    let feedTime = 0;\n\n    for (let i = 0; i < numberOfFeeds; i++) {\n        feedTime = startFeedTimeSeconds + i * Math.round((lastFeedTime - startFeedTimeSeconds) / (numberOfFeeds - 1));\n        feedTime = feedTime % (24 * 60 * 60);\n\n        let hours = Math.floor(feedTime / 3600);\n        let minutes = Math.floor((feedTime % 3600) / 60);\n        let seconds = feedTime % 60;\n\n        hours = hours < 10 ? \"0\" + hours : hours;\n        minutes = minutes < 10 ? \"0\" + minutes : minutes;\n        seconds = seconds < 10 ? \"0\" + seconds : seconds;\n\n        feedTimes.push(hours + \":\" + minutes + \":\" + seconds);\n    }\n\n    return feedTimes;\n}\n\nfunction checkFeedTime(feedTimes) {\n    let currentTime = new Date();\n    let currentHour = currentTime.getHours();\n    let currentMinute = currentTime.getMinutes();\n    let currentSecond = currentTime.getSeconds();\n    let currentTotalSeconds = (currentHour * 60 * 60) + (currentMinute * 60) + currentSecond;\n\n    console.log(\"Current time (seconds):\", currentTotalSeconds);\n\n    let numberOfFeeds = feedTimes.length;\n    let lastFeedTime = context.get(\"lastFeedTime\") || 0;\n\n    for (let i = 0; i < numberOfFeeds; i++) {\n        let feedTimeSeconds = convertTime(feedTimes[i]);\n        let timeDiffSeconds = Math.abs(currentTotalSeconds - feedTimeSeconds);\n\n        if (timeDiffSeconds <= 30 && feedTimeSeconds !== lastFeedTime) {\n            context.set(\"lastFeedTime\", feedTimeSeconds);\n            return \"feed\";\n        }\n    }\n\n    return \"no feed\";\n}\n\nfunction formatFeedTimes(feedTimes) {\n    let formattedFeedTimes = feedTimes.map(feedTime => feedTime.toString());\n    let table = formattedFeedTimes.join(\"\\n\");\n    return table;\n}\nlet formattedFeedTimes = formatFeedTimes(feedTimes);\nlet feedAction = checkFeedTime(feedTimes);\nif (feedAction === \"feed\") {\n    node.status({ fill: \"green\", shape: \"dot\", text: \"Feed\" });\n    return [{ payload: \"feed\" }, null];\n} else {\n    node.status({ fill: \"blue\", shape: \"dot\", text: \"No Feed\" });\n    return [null, { payload: formattedFeedTimes }];\n}",
        "outputs": 2,
        "noerr": 0,
        "initialize": "",
        "finalize": "",
        "libs": [],
        "x": 340,
        "y": 60,
        "wires": [
            [
                "2ca86b93ec06f656",
                "c33a11fbd2ec0228"
            ],
            [
                "4b169d6b8e904fcd"
            ]
        ]
    }
]