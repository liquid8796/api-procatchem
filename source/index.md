---
title: PROCatchem Lua Script API

language_tabs:
  - lua

toc_footers:
  - <a href='openapi.yaml'>OpenAPI YAML</a>
  - <a href='examples/basic-script.lua'>Basic script example</a>
  - <a href='examples/notification-script.lua'>Notification example</a>
  - <a href='examples/opponent-gender-and-dismount.lua'>Gender + dismount example</a>

search: true
---


# Introduction

PROCatchem exposes a Lua API for script authors. Every entry now includes a practical scenario showing where the API belongs in a real script.

These are **Lua functions**, not HTTP endpoints. The included `openapi.yaml` is retained only as source metadata for tooling.

## Basic script shape

~~~ lua
name = "Example Script"
author = "YourName"
description = "Simple PROCatchem script."

function onPathAction()
    if getMapName() == "Viridian City" then
        moveToGrass()
    end
end

function onBattleAction()
    attack()
end
~~~

## Action rule

A script should execute at most one path or battle action per frame. Query/helper functions can be called freely. The examples explicitly `return` after actions where this matters.

## PC storage note

PC storage updates are asynchronous. After deposit, withdraw, swap, internal box swap, or release, wait for the server update and re-check PC/team state before issuing the next dependent action.

## Battle-only note

Opponent APIs such as `getOpponentGender()` are valid only during battle. Calling them outside battle follows the tool's fatal Lua error contract.


# Script metadata

## name()

~~~ lua
name = "Viridian Training Route"
~~~

**Signature**

`result = name()`

Script display name shown in the tool.

**Practical scenario**

Set this metadata once at the top of the Lua file so the Scripts tab displays a recognizable name.

```lua
name = "Viridian Training Route"
```

### Returns

`string` — example: `"value"`

<small>Source key: `GET /lua/metadata/name`</small>


## author()

~~~ lua
author = "Iron Stark"
~~~

**Signature**

`result = author()`

Script author displayed in the tool.

**Practical scenario**

Set this metadata once at the top of the Lua file so users know who maintains the script.

```lua
author = "Iron Stark"
```

### Returns

`string` — example: `"value"`

<small>Source key: `GET /lua/metadata/author`</small>


## description()

~~~ lua
description = "Trains in Viridian Forest and returns to the Pokécenter below 25% HP."
~~~

**Signature**

`result = description()`

Short script description displayed in the tool.

**Practical scenario**

Use this metadata to explain the route, requirements, and intended behavior before the script starts.

```lua
description = "Trains in Viridian Forest and returns to the Pokécenter below 25% HP."
```

### Returns

`string` — example: `"value"`

<small>Source key: `GET /lua/metadata/description`</small>



# Lifecycle callbacks

## onStart()

~~~ lua
local encounters = 0

function onStart()
    encounters = 0
    log("Training script started on " .. getMapName())
end
~~~

**Signature**

`onStart()`

Called when the script starts.

**Practical scenario**

Initialize counters and log the starting state when the user starts the script.

```lua
local encounters = 0

function onStart()
    encounters = 0
    log("Training script started on " .. getMapName())
end
```

### Returns

`void`

<small>Source key: `POST /lua/callbacks/onStart`</small>


## onStop()

~~~ lua
function onStop()
    log("Script stopped safely.")
end
~~~

**Signature**

`onStop()`

Called when the script stops.

**Practical scenario**

Persist or report final state before the runtime finishes the script.

```lua
function onStop()
    log("Script stopped safely.")
end
```

### Returns

`void`

<small>Source key: `POST /lua/callbacks/onStop`</small>


## onPause()

~~~ lua
function onPause()
    log("Lua automation paused.")
end
~~~

**Signature**

`onPause()`

Called when the script is paused.

**Practical scenario**

Use this callback for status logging or pausing your own timers.

```lua
function onPause()
    log("Lua automation paused.")
end
```

### Returns

`void`

<small>Source key: `POST /lua/callbacks/onPause`</small>


## onResume()

~~~ lua
function onResume()
    log("Lua automation resumed on " .. getMapName())
end
~~~

**Signature**

`onResume()`

Called when the script resumes.

**Practical scenario**

Re-check game state because the player may have moved or changed the team while paused.

```lua
function onResume()
    log("Lua automation resumed on " .. getMapName())
end
```

### Returns

`void`

<small>Source key: `POST /lua/callbacks/onResume`</small>


## onPathAction()

~~~ lua
function onPathAction()
    if getPokemonHealthPercent(1) < 25 then
        usePokecenter()
        return
    end

    moveToGrass()
end
~~~

**Signature**

`onPathAction()`

Called repeatedly while the player is outside battle. Execute at most one path action per frame.

**Practical scenario**

This is the main overworld decision callback. Perform no more than one path action per call.

```lua
function onPathAction()
    if getPokemonHealthPercent(1) < 25 then
        usePokecenter()
        return
    end

    moveToGrass()
end
```

### Returns

`void`

<small>Source key: `POST /lua/callbacks/onPathAction`</small>


## onBattleAction()

~~~ lua
function onBattleAction()
    if isOpponentShiny() or not isAlreadyCaught() then
        weakAttack()
        return
    end

    attack()
end
~~~

**Signature**

`onBattleAction()`

Called repeatedly while the player is in battle. Execute at most one battle action per frame.

**Practical scenario**

This is the main battle decision callback. Perform no more than one battle action per call.

```lua
function onBattleAction()
    if isOpponentShiny() or not isAlreadyCaught() then
        weakAttack()
        return
    end

    attack()
end
```

### Returns

`void`

<small>Source key: `POST /lua/callbacks/onBattleAction`</small>


## onDialogMessage()

~~~ lua
function onDialogMessage(message)
    if stringContains(message, "badge") then
        log("Badge requirement detected: " .. message)
    end
end
~~~

**Signature**

`onDialogMessage(message)`

Called when a dialog message is received.

**Practical scenario**

Inspect NPC text to track quests or diagnose unexpected dialog branches.

```lua
function onDialogMessage(message)
    if stringContains(message, "badge") then
        log("Badge requirement detected: " .. message)
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `message` | `string` | yes | Message text provided by the game or sent by the script. |

### Returns

`void`

<small>Source key: `POST /lua/callbacks/onDialogMessage`</small>


## onBattleMessage()

~~~ lua
function onBattleMessage(message)
    if stringContains(message, "fainted") then
        log("A Pokémon fainted: " .. message)
    end
end
~~~

**Signature**

`onBattleMessage(message)`

Called when a battle message is received.

**Practical scenario**

Inspect battle text for events that are not exposed as dedicated state helpers.

```lua
function onBattleMessage(message)
    if stringContains(message, "fainted") then
        log("A Pokémon fainted: " .. message)
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `message` | `string` | yes | Message text provided by the game or sent by the script. |

### Returns

`void`

<small>Source key: `POST /lua/callbacks/onBattleMessage`</small>


## onSystemMessage()

~~~ lua
function onSystemMessage(message)
    log("SYSTEM: " .. message)
end
~~~

**Signature**

`onSystemMessage(message)`

Called when a system message is received.

**Practical scenario**

Use system messages to confirm server-side actions such as catches, releases, or item usage.

```lua
function onSystemMessage(message)
    log("SYSTEM: " .. message)
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `message` | `string` | yes | Message text provided by the game or sent by the script. |

### Returns

`void`

<small>Source key: `POST /lua/callbacks/onSystemMessage`</small>


## onWarningMessage()

~~~ lua
function onWarningMessage(message)
    logToFile("logs/warnings.txt", message)
end
~~~

**Signature**

`onWarningMessage(differentMap, distance)`

Called when a warning message is received; distance can be -1 when unavailable.

**Practical scenario**

Record warnings so a long-running script can be diagnosed later.

```lua
function onWarningMessage(message)
    logToFile("logs/warnings.txt", message)
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `differentMap` | `boolean` | yes | Value passed to the `differentMap` parameter. |
| `distance` | `integer` | yes | Value passed to the `distance` parameter. |

### Returns

`void`

<small>Source key: `POST /lua/callbacks/onWarningMessage`</small>


## onLearningMove()

~~~ lua
function onLearningMove(moveName, pokemonIndex)
    if moveName == "Thunderbolt" then
        forgetAnyMoveExcept("Thunderbolt")
    else
        forgetMove(1)
    end
end
~~~

**Signature**

`onLearningMove(moveName, pokemonIndex)`

Called when a Pokémon is learning a move.

**Practical scenario**

Choose which move to forget when the game asks a Pokémon to learn a new move.

```lua
function onLearningMove(moveName, pokemonIndex)
    if moveName == "Thunderbolt" then
        forgetAnyMoveExcept("Thunderbolt")
    else
        forgetMove(1)
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `moveName` | `string` | yes | Exact move name as shown by the game. |
| `pokemonIndex` | `integer` | yes | One-based Pokémon index in the current team. |

### Returns

`void`

<small>Source key: `POST /lua/callbacks/onLearningMove`</small>



# Core utilities

## log()

~~~ lua
function onStart()
    log("Script started on " .. getMapName())
end
~~~

**Signature**

`log(message)`

Displays the specified message to the message log.

**Practical scenario**

Write concise diagnostics that identify the current map, Pokémon, or decision branch.

```lua
function onStart()
    log("Script started on " .. getMapName())
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `message` | `string` | yes | Message text provided by the game or sent by the script. |

### Returns

`void`

<small>Source key: `POST /lua/core-utilities/log`</small>


## fatal()

~~~ lua
function onStart()
    if getTeamSize() == 0 then
        fatal("A Pokémon team is required before this script can run.")
    end
end
~~~

**Signature**

`fatal(message)`

Displays the specified message to the message log and stop the bot.

**Practical scenario**

Stop immediately when a required precondition is missing and explain how the user can fix it.

```lua
function onStart()
    if getTeamSize() == 0 then
        fatal("A Pokémon team is required before this script can run.")
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `message` | `string` | yes | Message text provided by the game or sent by the script. |

### Returns

`void`

<small>Source key: `POST /lua/core-utilities/fatal`</small>


## logout()

~~~ lua
function onPathAction()
    if getMoney() < 100 then
        logout("Stopping: not enough money to continue safely.")
        return
    end
end
~~~

**Signature**

`logout(message)`

Displays the specified message to the message log and logs out.

**Practical scenario**

Use a guarded condition so the script does not request logout on every frame.

```lua
function onPathAction()
    if getMoney() < 100 then
        logout("Stopping: not enough money to continue safely.")
        return
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `message` | `string` | yes | Message text provided by the game or sent by the script. |

### Returns

`void`

<small>Source key: `POST /lua/core-utilities/logout`</small>


## relog()

~~~ lua
function onWarningMessage(differentMap, distance)
    if differentMap then
        relog(15, "Map synchronization failed; reconnecting.")
    end
end
~~~

**Signature**

`relog(delay, message)`

Logs out and logs back in after the specified number of seconds.

**Practical scenario**

Schedule a reconnect only from a guarded branch, such as recovering from a known server state.

```lua
function onWarningMessage(differentMap, distance)
    if differentMap then
        relog(15, "Map synchronization failed; reconnecting.")
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `delay` | `number` | yes | Value passed to the `delay` parameter. |
| `message` | `string` | yes | Message text provided by the game or sent by the script. |

### Returns

`void`

<small>Source key: `POST /lua/core-utilities/relog`</small>


## restart()

~~~ lua
function onWarningMessage(differentMap, distance)
    if distance > 10 then
        restart(5, "Player position is too far from the expected route.")
    end
end
~~~

**Signature**

`restart(delay, message)`

Start the script.

**Practical scenario**

Restart a script only after detecting a state that cannot be recovered inside the current run.

```lua
function onWarningMessage(differentMap, distance)
    if distance > 10 then
        restart(5, "Player position is too far from the expected route.")
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `delay` | `integer` | yes | Value passed to the `delay` parameter. |
| `message` | `string` | yes | Message text provided by the game or sent by the script. |

### Returns

`void`

<small>Source key: `POST /lua/core-utilities/restart`</small>


## stringContains()

~~~ lua
function onDialogMessage(message)
    if stringContains(message, "other badges") then
        log("This NPC is blocking progress until more badges are earned.")
    end
end
~~~

**Signature**

`result = stringContains(haystack, needle)`

Returns true if the string contains the specified part, ignoring the case.

**Practical scenario**

Use case-insensitive message checks to recognize dialog, battle, or system text.

```lua
function onDialogMessage(message)
    if stringContains(message, "other badges") then
        log("This NPC is blocking progress until more badges are earned.")
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `haystack` | `string` | yes | Value passed to the `haystack` parameter. |
| `needle` | `string` | yes | Value passed to the `needle` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/core-utilities/stringcontains`</small>


## playSound()

~~~ lua
function onStart()
    function onStart()
    playSound("logs/script.txt")
end
end
~~~

**Signature**

`playSound(file)`

Returns playing a custom sound.

**Practical scenario**

Use this helper for diagnostics or lifecycle control. Avoid calling restart/logout helpers repeatedly every frame.

```lua
function onStart()
    function onStart()
    playSound("logs/script.txt")
end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `file` | `string` | yes | Path relative to the script/tool data directory. |

### Returns

`void`

<small>Source key: `POST /lua/core-utilities/playsound`</small>


## registerHook()

~~~ lua
function onStart()
    registerHook("battle", function(message)
        log("Battle hook: " .. tostring(message))
    end)
end
~~~

**Signature**

`registerHook(eventName, callback)`

Calls the specified function when the specified event occurs.

**Practical scenario**

Register a callback once, usually from `onStart`, rather than registering it every frame.

```lua
function onStart()
    registerHook("battle", function(message)
        log("Battle hook: " .. tostring(message))
    end)
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `eventName` | `string` | yes | Value passed to the `eventName` parameter. |
| `callback` | `LuaValue` | yes | Any Lua value. |

### Returns

`void`

<small>Source key: `POST /lua/core-utilities/registerhook`</small>



# Workflow

## executeSteps()

~~~ lua
local nextStep = 1

function onPathAction()
    local result = executeSteps({
        { "log map", function() log(getMapName()) end },
        { "move", moveToGrass }
    }, { stopOnAction = true, logProgress = true, startIndex = nextStep })

    nextStep = result.nextIndex or 1
end
~~~

**Signature**

`executeSteps(steps, options)`

Runs a list of steps (other Lua functions/APIs) as one ordered action. Each step is a function, a `{ "name", function }` pair, or a `{ name, run, args, continueOnError }` table. Honours the one-bot-action-per-frame rule via `stopOnAction` (default true): it stops at the first step that performs a bot action and returns `nextIndex` to resume next frame.

**Practical scenario**

Group query/helper work and stop at the first real bot action, then resume from `nextIndex` on a later frame.

```lua
local nextStep = 1

function onPathAction()
    local result = executeSteps({
        { "log map", function() log(getMapName()) end },
        { "move", moveToGrass }
    }, { stopOnAction = true, logProgress = true, startIndex = nextStep })

    nextStep = result.nextIndex or 1
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `steps` | `array<object>` | yes | Ordered Lua functions/step descriptors to execute. |
| `options` | `object` | no | Optional execution settings table. |

### Returns

`object`

<small>Source key: `POST /lua/workflow/execute-steps`</small>



# Map and NPC

## getPlayerX()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPlayerX()
    log("getPlayerX: " .. tostring(result))
end
    log("getPlayerX: " .. tostring(result))
end
~~~

**Signature**

`result = getPlayerX()`

Returns the X-coordinate of the current cell.

**Practical scenario**

Use this query in overworld logic to choose a safe destination or NPC interaction.

```lua
function onPathAction()
    function onPathAction()
    local result = getPlayerX()
    log("getPlayerX: " .. tostring(result))
end
    log("getPlayerX: " .. tostring(result))
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/map-and-npc/getplayerx`</small>


## getPlayerY()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPlayerY()
    log("getPlayerY: " .. tostring(result))
end
    log("getPlayerY: " .. tostring(result))
end
~~~

**Signature**

`result = getPlayerY()`

Returns the Y-coordinate of the current cell.

**Practical scenario**

Use this query in overworld logic to choose a safe destination or NPC interaction.

```lua
function onPathAction()
    function onPathAction()
    local result = getPlayerY()
    log("getPlayerY: " .. tostring(result))
end
    log("getPlayerY: " .. tostring(result))
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/map-and-npc/getplayery`</small>


## getMapName()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getMapName()
    log("getMapName: " .. tostring(result))
end
    log("getMapName: " .. tostring(result))
end
~~~

**Signature**

`result = getMapName()`

Returns the name of the current map.

**Practical scenario**

Use this query in overworld logic to choose a safe destination or NPC interaction.

```lua
function onPathAction()
    function onPathAction()
    local result = getMapName()
    log("getMapName: " .. tostring(result))
end
    log("getMapName: " .. tostring(result))
end
```

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/map-and-npc/getmapname`</small>


## getActiveBattlers()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getActiveBattlers()
    log("getActiveBattlers: " .. tostring(result))
end
    log("getActiveBattlers: " .. tostring(result))
end
~~~

**Signature**

`result = getActiveBattlers()`

API return an array of all NPCs that can be challenged on the current map. format : {"npcName" = {"x" = x, "y" = y}}

**Practical scenario**

Use this query in overworld logic to choose a safe destination or NPC interaction.

```lua
function onPathAction()
    function onPathAction()
    local result = getActiveBattlers()
    log("getActiveBattlers: " .. tostring(result))
end
    log("getActiveBattlers: " .. tostring(result))
end
```

### Returns

`object` — example: `{}`

<small>Source key: `POST /lua/map-and-npc/getactivebattlers`</small>


## getActiveDigSpots()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getActiveDigSpots()
    log("getActiveDigSpots: " .. tostring(result))
end
    log("getActiveDigSpots: " .. tostring(result))
end
~~~

**Signature**

`result = getActiveDigSpots()`

API return an array of all usable Dig Spots on the currrent map. format : {index = {"x" = x, "y" = y}}

**Practical scenario**

Use this query in overworld logic to choose a safe destination or NPC interaction.

```lua
function onPathAction()
    function onPathAction()
    local result = getActiveDigSpots()
    log("getActiveDigSpots: " .. tostring(result))
end
    log("getActiveDigSpots: " .. tostring(result))
end
```

### Returns

`array<object>` — example: `{}`

<small>Source key: `POST /lua/map-and-npc/getactivedigspots`</small>


## getActiveHeadbuttTrees()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getActiveHeadbuttTrees()
    log("getActiveHeadbuttTrees: " .. tostring(result))
end
    log("getActiveHeadbuttTrees: " .. tostring(result))
end
~~~

**Signature**

`result = getActiveHeadbuttTrees()`

API return an array of all usable Headbutt trees on the currrent map. format : {index = {"x" = x, "y" = y}}

**Practical scenario**

Use this query in overworld logic to choose a safe destination or NPC interaction.

```lua
function onPathAction()
    function onPathAction()
    local result = getActiveHeadbuttTrees()
    log("getActiveHeadbuttTrees: " .. tostring(result))
end
    log("getActiveHeadbuttTrees: " .. tostring(result))
end
```

### Returns

`array<object>` — example: `{}`

<small>Source key: `POST /lua/map-and-npc/getactiveheadbutttrees`</small>


## getActiveBerryTrees()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getActiveBerryTrees()
    log("getActiveBerryTrees: " .. tostring(result))
end
    log("getActiveBerryTrees: " .. tostring(result))
end
~~~

**Signature**

`result = getActiveBerryTrees()`

API return an array of all harvestable berry trees on the currrent map. format : {index = {"x" = x, "y" = y}}

**Practical scenario**

Use this query in overworld logic to choose a safe destination or NPC interaction.

```lua
function onPathAction()
    function onPathAction()
    local result = getActiveBerryTrees()
    log("getActiveBerryTrees: " .. tostring(result))
end
    log("getActiveBerryTrees: " .. tostring(result))
end
```

### Returns

`array<object>` — example: `{}`

<small>Source key: `POST /lua/map-and-npc/getactiveberrytrees`</small>


## getDiscoverableItems()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getDiscoverableItems()
    log("getDiscoverableItems: " .. tostring(result))
end
    log("getDiscoverableItems: " .. tostring(result))
end
~~~

**Signature**

`result = getDiscoverableItems()`

API return an array of all discoverable items on the currrent map. format : {index = {"x" = x, "y" = y}}

**Practical scenario**

Use this query in overworld logic to choose a safe destination or NPC interaction.

```lua
function onPathAction()
    function onPathAction()
    local result = getDiscoverableItems()
    log("getDiscoverableItems: " .. tostring(result))
end
    log("getDiscoverableItems: " .. tostring(result))
end
```

### Returns

`array<object>` — example: `{}`

<small>Source key: `POST /lua/map-and-npc/getdiscoverableitems`</small>


## getDiscoverablePokestops()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getDiscoverablePokestops()
    log("getDiscoverablePokestops: " .. tostring(result))
end
    log("getDiscoverablePokestops: " .. tostring(result))
end
~~~

**Signature**

`result = getDiscoverablePokestops()`

API return an array of all pokestops on the current map. format : {index = {"x" = x, "y" = y}}

**Practical scenario**

Use this query in overworld logic to choose a safe destination or NPC interaction.

```lua
function onPathAction()
    function onPathAction()
    local result = getDiscoverablePokestops()
    log("getDiscoverablePokestops: " .. tostring(result))
end
    log("getDiscoverablePokestops: " .. tostring(result))
end
```

### Returns

`array<object>` — example: `{}`

<small>Source key: `POST /lua/map-and-npc/getdiscoverablepokestops`</small>


## getDiscoverableAbandonedPokemon()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getDiscoverableAbandonedPokemon()
    log("getDiscoverableAbandonedPokemon: " .. tostring(result))
end
    log("getDiscoverableAbandonedPokemon: " .. tostring(result))
end
~~~

**Signature**

`result = getDiscoverableAbandonedPokemon()`

API return an array of all Abandoned Pokemon on the current map. format : {index = {"x" = x, "y" = y}}

**Practical scenario**

Use this query in overworld logic to choose a safe destination or NPC interaction.

```lua
function onPathAction()
    function onPathAction()
    local result = getDiscoverableAbandonedPokemon()
    log("getDiscoverableAbandonedPokemon: " .. tostring(result))
end
    log("getDiscoverableAbandonedPokemon: " .. tostring(result))
end
```

### Returns

`array<object>` — example: `{}`

<small>Source key: `POST /lua/map-and-npc/getdiscoverableabandonedpokemon`</small>


## getNpcData()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getNpcData()
    log("getNpcData: " .. tostring(result))
end
    log("getNpcData: " .. tostring(result))
end
~~~

**Signature**

`result = getNpcData()`

Returns npc data on current map, format : { { "x" = x , "y" = y, "type" = type }, {...}, ... }

**Practical scenario**

Use this query in overworld logic to choose a safe destination or NPC interaction.

```lua
function onPathAction()
    function onPathAction()
    local result = getNpcData()
    log("getNpcData: " .. tostring(result))
end
    log("getNpcData: " .. tostring(result))
end
```

### Returns

`array<object>` — example: `{}`

<small>Source key: `POST /lua/map-and-npc/getnpcdata`</small>


## getMapLinks()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getMapLinks()
    log("getMapLinks: " .. tostring(result))
end
    log("getMapLinks: " .. tostring(result))
end
~~~

**Signature**

`result = getMapLinks()`

Lua function `getMapLinks`.

**Practical scenario**

Use this query in overworld logic to choose a safe destination or NPC interaction.

```lua
function onPathAction()
    function onPathAction()
    local result = getMapLinks()
    log("getMapLinks: " .. tostring(result))
end
    log("getMapLinks: " .. tostring(result))
end
```

### Returns

`array<object>` — example: `{}`

<small>Source key: `POST /lua/map-and-npc/getmaplinks`</small>


## getMapWidth()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getMapWidth()
    log("getMapWidth: " .. tostring(result))
end
    log("getMapWidth: " .. tostring(result))
end
~~~

**Signature**

`result = getMapWidth()`

The number of cells on the current map in the x direction.

**Practical scenario**

Use this query in overworld logic to choose a safe destination or NPC interaction.

```lua
function onPathAction()
    function onPathAction()
    local result = getMapWidth()
    log("getMapWidth: " .. tostring(result))
end
    log("getMapWidth: " .. tostring(result))
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/map-and-npc/getmapwidth`</small>


## getMapHeight()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getMapHeight()
    log("getMapHeight: " .. tostring(result))
end
    log("getMapHeight: " .. tostring(result))
end
~~~

**Signature**

`result = getMapHeight()`

The number of cells on the current map in the y direction.

**Practical scenario**

Use this query in overworld logic to choose a safe destination or NPC interaction.

```lua
function onPathAction()
    function onPathAction()
    local result = getMapHeight()
    log("getMapHeight: " .. tostring(result))
end
    log("getMapHeight: " .. tostring(result))
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/map-and-npc/getmapheight`</small>


## getCellType()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getCellType(10, 15)
    log("getCellType: " .. tostring(result))
end
    log("getCellType: " .. tostring(result))
end
~~~

**Signature**

`result = getCellType(x, y)`

Returns the cell type of the specified cell on the current map.

**Practical scenario**

Use this query in overworld logic to choose a safe destination or NPC interaction.

```lua
function onPathAction()
    function onPathAction()
    local result = getCellType(10, 15)
    log("getCellType: " .. tostring(result))
end
    log("getCellType: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `x` | `integer` | yes | Map X coordinate. |
| `y` | `integer` | yes | Map Y coordinate. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/map-and-npc/getcelltype`</small>


## isNpcVisible()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isNpcVisible("Nurse Joy")
    log("isNpcVisible: " .. tostring(result))
end
    log("isNpcVisible: " .. tostring(result))
end
~~~

**Signature**

`result = isNpcVisible(npcName)`

Returns true if there is a visible NPC with the specified name on the map.

**Practical scenario**

Use this query in overworld logic to choose a safe destination or NPC interaction.

```lua
function onPathAction()
    function onPathAction()
    local result = isNpcVisible("Nurse Joy")
    log("isNpcVisible: " .. tostring(result))
end
    log("isNpcVisible: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `npcName` | `string` | yes | Exact or documented NPC name. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/map-and-npc/isnpcvisible`</small>


## isNpcOnCell()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isNpcOnCell(10, 15)
    log("isNpcOnCell: " .. tostring(result))
end
    log("isNpcOnCell: " .. tostring(result))
end
~~~

**Signature**

`result = isNpcOnCell(cellX, cellY)`

Returns true if there is a visible NPC the specified coordinates.

**Practical scenario**

Use this query in overworld logic to choose a safe destination or NPC interaction.

```lua
function onPathAction()
    function onPathAction()
    local result = isNpcOnCell(10, 15)
    log("isNpcOnCell: " .. tostring(result))
end
    log("isNpcOnCell: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `cellX` | `integer` | yes | Value passed to the `cellX` parameter. |
| `cellY` | `integer` | yes | Value passed to the `cellY` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/map-and-npc/isnpconcell`</small>


## isInArea()

~~~ lua
function onPathAction()
    local insideRoute = isInArea(">=:10->=:15?&&,<=:20-<=:25?&&")
    if insideRoute then
        moveToGrass()
        return
    end
end
~~~

**Signature**

`result = isInArea(text)`

Check condition list cell

**Practical scenario**

Use the condition-string syntax expected by the tool to test whether the current coordinates satisfy a route region.

```lua
function onPathAction()
    local insideRoute = isInArea(">=:10->=:15?&&,<=:20-<=:25?&&")
    if insideRoute then
        moveToGrass()
        return
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `text` | `string` | yes | Value passed to the `text` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/map-and-npc/isinarea`</small>



# General state

## getAccountName()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getAccountName()
    log("getAccountName: " .. tostring(result))
end
    log("getAccountName: " .. tostring(result))
end
~~~

**Signature**

`result = getAccountName()`

Returns current account name.

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = getAccountName()
    log("getAccountName: " .. tostring(result))
end
    log("getAccountName: " .. tostring(result))
end
```

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/general-state/getaccountname`</small>


## getPokedexOwned()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokedexOwned()
    log("getPokedexOwned: " .. tostring(result))
end
    log("getPokedexOwned: " .. tostring(result))
end
~~~

**Signature**

`result = getPokedexOwned()`

Returns Owned Entry of the pokedex

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokedexOwned()
    log("getPokedexOwned: " .. tostring(result))
end
    log("getPokedexOwned: " .. tostring(result))
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/general-state/getpokedexowned`</small>


## getPokedexSeen()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokedexSeen()
    log("getPokedexSeen: " .. tostring(result))
end
    log("getPokedexSeen: " .. tostring(result))
end
~~~

**Signature**

`result = getPokedexSeen()`

Returns Seen Entry of the pokedex

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokedexSeen()
    log("getPokedexSeen: " .. tostring(result))
end
    log("getPokedexSeen: " .. tostring(result))
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/general-state/getpokedexseen`</small>


## getPokedexEvolved()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokedexEvolved()
    log("getPokedexEvolved: " .. tostring(result))
end
    log("getPokedexEvolved: " .. tostring(result))
end
~~~

**Signature**

`result = getPokedexEvolved()`

Returns Evolved Entry of the pokedex

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokedexEvolved()
    log("getPokedexEvolved: " .. tostring(result))
end
    log("getPokedexEvolved: " .. tostring(result))
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/general-state/getpokedexevolved`</small>


## getTeamSize()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getTeamSize()
    log("getTeamSize: " .. tostring(result))
end
    log("getTeamSize: " .. tostring(result))
end
~~~

**Signature**

`result = getTeamSize()`

Returns the amount of pokémon in the team.

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = getTeamSize()
    log("getTeamSize: " .. tostring(result))
end
    log("getTeamSize: " .. tostring(result))
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/general-state/getteamsize`</small>


## isGameScriptActive()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isGameScriptActive()
    log("isGameScriptActive: " .. tostring(result))
end
    log("isGameScriptActive: " .. tostring(result))
end
~~~

**Signature**

`result = isGameScriptActive()`

Lua function `isGameScriptActive`.

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = isGameScriptActive()
    log("isGameScriptActive: " .. tostring(result))
end
    log("isGameScriptActive: " .. tostring(result))
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/general-state/isgamescriptactive`</small>


## isAccountMember()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isAccountMember()
    log("isAccountMember: " .. tostring(result))
end
    log("isAccountMember: " .. tostring(result))
end
~~~

**Signature**

`result = isAccountMember()`

Returns current account's membership status.

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = isAccountMember()
    log("isAccountMember: " .. tostring(result))
end
    log("isAccountMember: " .. tostring(result))
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/general-state/isaccountmember`</small>


## getRemainingPowerPoints()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getRemainingPowerPoints(1, "Tackle")
    log("getRemainingPowerPoints: " .. tostring(result))
end
    log("getRemainingPowerPoints: " .. tostring(result))
end
~~~

**Signature**

`result = getRemainingPowerPoints(pokemonIndex, moveName)`

Returns the remaining power points of the specified move of the specified pokémon in the team.

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = getRemainingPowerPoints(1, "Tackle")
    log("getRemainingPowerPoints: " .. tostring(result))
end
    log("getRemainingPowerPoints: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `pokemonIndex` | `integer` | yes | One-based Pokémon index in the current team. |
| `moveName` | `string` | yes | Exact move name as shown by the game. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/general-state/getremainingpowerpoints`</small>


## isShopOpen()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isShopOpen()
    log("isShopOpen: " .. tostring(result))
end
    log("isShopOpen: " .. tostring(result))
end
~~~

**Signature**

`result = isShopOpen()`

Returns true if there is a shop opened.

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = isShopOpen()
    log("isShopOpen: " .. tostring(result))
end
    log("isShopOpen: " .. tostring(result))
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/general-state/isshopopen`</small>


## isRelearningMoves()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isRelearningMoves()
    log("isRelearningMoves: " .. tostring(result))
end
    log("isRelearningMoves: " .. tostring(result))
end
~~~

**Signature**

`result = isRelearningMoves()`

Returns true if the player is relearning the move of a Pokemon from an NPC.

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = isRelearningMoves()
    log("isRelearningMoves: " .. tostring(result))
end
    log("isRelearningMoves: " .. tostring(result))
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/general-state/isrelearningmoves`</small>


## getMoney()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getMoney()
    log("getMoney: " .. tostring(result))
end
    log("getMoney: " .. tostring(result))
end
~~~

**Signature**

`result = getMoney()`

Returns the amount of money in the inventory.

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = getMoney()
    log("getMoney: " .. tostring(result))
end
    log("getMoney: " .. tostring(result))
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/general-state/getmoney`</small>


## isMounted()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isMounted()
    log("isMounted: " .. tostring(result))
end
    log("isMounted: " .. tostring(result))
end
~~~

**Signature**

`result = isMounted()`

Returns true if the player is riding a mount or the bicycle.

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = isMounted()
    log("isMounted: " .. tostring(result))
end
    log("isMounted: " .. tostring(result))
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/general-state/ismounted`</small>


## isSurfing()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isSurfing()
    log("isSurfing: " .. tostring(result))
end
    log("isSurfing: " .. tostring(result))
end
~~~

**Signature**

`result = isSurfing()`

Returns true if the player is surfing

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = isSurfing()
    log("isSurfing: " .. tostring(result))
end
    log("isSurfing: " .. tostring(result))
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/general-state/issurfing`</small>


## isPrivateMessageEnabled()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isPrivateMessageEnabled()
    log("isPrivateMessageEnabled: " .. tostring(result))
end
    log("isPrivateMessageEnabled: " .. tostring(result))
end
~~~

**Signature**

`result = isPrivateMessageEnabled()`

Check if the private message from normal users are blocked.

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = isPrivateMessageEnabled()
    log("isPrivateMessageEnabled: " .. tostring(result))
end
    log("isPrivateMessageEnabled: " .. tostring(result))
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/general-state/isprivatemessageenabled`</small>


## isPartyInspectionEnabled()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isPartyInspectionEnabled()
    log("isPartyInspectionEnabled: " .. tostring(result))
end
    log("isPartyInspectionEnabled: " .. tostring(result))
end
~~~

**Signature**

`result = isPartyInspectionEnabled()`

Check if party inspections are turned on.

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = isPartyInspectionEnabled()
    log("isPartyInspectionEnabled: " .. tostring(result))
end
    log("isPartyInspectionEnabled: " .. tostring(result))
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/general-state/ispartyinspectionenabled`</small>


## isNpcInteractionsEnabled()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isNpcInteractionsEnabled()
    log("isNpcInteractionsEnabled: " .. tostring(result))
end
    log("isNpcInteractionsEnabled: " .. tostring(result))
end
~~~

**Signature**

`result = isNpcInteractionsEnabled()`

Returns true if the bot is checking for npc interactions.

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = isNpcInteractionsEnabled()
    log("isNpcInteractionsEnabled: " .. tostring(result))
end
    log("isNpcInteractionsEnabled: " .. tostring(result))
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/general-state/isnpcinteractionsenabled`</small>


## getTime()

~~~ lua
function onPathAction()
    local hour, minute = getTime()

    if hour >= 20 or hour < 5 then
        log(string.format("Night route active at %02d:%02d", hour, minute))
        moveToGrass()
        return
    end
end
~~~

**Signature**

`hour, minute = getTime()`

Return the current in game hour and minute.

**Practical scenario**

Read both return values when a route should run only during a specific in-game time window.

```lua
function onPathAction()
    local hour, minute = getTime()

    if hour >= 20 or hour < 5 then
        log(string.format("Night route active at %02d:%02d", hour, minute))
        moveToGrass()
        return
    end
end
```

### Returns

`object` — example: `{"hour": 12, "minute": 34}`

<small>Source key: `POST /lua/general-state/gettime`</small>


## isMorning()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isMorning()
    log("isMorning: " .. tostring(result))
end
    log("isMorning: " .. tostring(result))
end
~~~

**Signature**

`result = isMorning()`

Return true if morning time.

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = isMorning()
    log("isMorning: " .. tostring(result))
end
    log("isMorning: " .. tostring(result))
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/general-state/ismorning`</small>


## isNoon()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isNoon()
    log("isNoon: " .. tostring(result))
end
    log("isNoon: " .. tostring(result))
end
~~~

**Signature**

`result = isNoon()`

Return true if noon time.

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = isNoon()
    log("isNoon: " .. tostring(result))
end
    log("isNoon: " .. tostring(result))
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/general-state/isnoon`</small>


## isNight()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isNight()
    log("isNight: " .. tostring(result))
end
    log("isNight: " .. tostring(result))
end
~~~

**Signature**

`result = isNight()`

Return true if night time.

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = isNight()
    log("isNight: " .. tostring(result))
end
    log("isNight: " .. tostring(result))
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/general-state/isnight`</small>


## isOutside()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isOutside()
    log("isOutside: " .. tostring(result))
end
    log("isOutside: " .. tostring(result))
end
~~~

**Signature**

`result = isOutside()`

Return true if the character is outside.

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = isOutside()
    log("isOutside: " .. tostring(result))
end
    log("isOutside: " .. tostring(result))
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/general-state/isoutside`</small>


## isAutoEvolve()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isAutoEvolve()
    log("isAutoEvolve: " .. tostring(result))
end
    log("isAutoEvolve: " .. tostring(result))
end
~~~

**Signature**

`result = isAutoEvolve()`

Return the state Auto Evolve

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = isAutoEvolve()
    log("isAutoEvolve: " .. tostring(result))
end
    log("isAutoEvolve: " .. tostring(result))
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/general-state/isautoevolve`</small>


## setMount()

~~~ lua
function onStart()
    function onStart()
    local result = setMount("Arcanine Mount")
    log("Configured setMount.")
end
    log("Configured setMount.")
end
~~~

**Signature**

`result = setMount(mount)`

Configure the ground mount or bike item that the bot should use while moving on outside ground maps. Pass the exact item name, for example `Arcanine Mount` or `Blue Bicycle`. Pass an empty string to clear the configured ground mount. The function only configures the item; the tool uses it automatically before movement when appropriate.

**Practical scenario**

Configure this state deliberately and verify the related query before issuing further movement.

```lua
function onStart()
    function onStart()
    local result = setMount("Arcanine Mount")
    log("Configured setMount.")
end
    log("Configured setMount.")
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `mount` | `string` | yes | Exact mount or bicycle item name; an empty string clears the configuration. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/general-state/setmount`</small>


## disMount()

~~~ lua
function onPathAction()
    if isMounted() and not isSurfing() then
        disMount()
        return
    end

    moveToCell(10, 15)
end
~~~

**Signature**

`result = disMount()`

Disables automatic ground mounting and dismounts the currently active ground mount by toggling the official mount item packet. It affects ground mounts and bicycles only; it does not cancel Surf. The configured ground mount is cleared, so call `setMount()` again before expecting automatic ground mounting later. Returns `true` when the configured mount was cleared or a dismount packet was sent, otherwise `false` when there was nothing to change.

**Practical scenario**

Use this before entering an area where a ground mount is unwanted. It also clears automatic ground-mount configuration.

```lua
function onPathAction()
    if isMounted() and not isSurfing() then
        disMount()
        return
    end

    moveToCell(10, 15)
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/general-state/dismount`</small>


## setWaterMount()

~~~ lua
function onStart()
    function onStart()
    local result = setWaterMount("Lapras Mount")
    log("Configured setWaterMount.")
end
    log("Configured setWaterMount.")
end
~~~

**Signature**

`result = setWaterMount(mount)`

Configure an optional water mount item that should be used when the bot needs to start surfing. Call this before a path that may enter water. Most scripts can leave it unset; without a water mount, `useSurf()` and pathfinding use the normal `/surf` flow. Pass an empty string to clear the configured water mount.

**Practical scenario**

Configure this state deliberately and verify the related query before issuing further movement.

```lua
function onStart()
    function onStart()
    local result = setWaterMount("Lapras Mount")
    log("Configured setWaterMount.")
end
    log("Configured setWaterMount.")
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `mount` | `string` | yes | Exact mount or bicycle item name; an empty string clears the configuration. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/general-state/setwatermount`</small>


## isCurrentPCBoxRefreshed()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isCurrentPCBoxRefreshed()
    log("isCurrentPCBoxRefreshed: " .. tostring(result))
end
    log("isCurrentPCBoxRefreshed: " .. tostring(result))
end
~~~

**Signature**

`result = isCurrentPCBoxRefreshed()`

Returns true when the latest requested PC box action has completed or there is no pending PC box refresh. Use this after `usePC()`, `openPCBox()`, or `refreshPCBox()` before reading PC Pokémon data.

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = isCurrentPCBoxRefreshed()
    log("isCurrentPCBoxRefreshed: " .. tostring(result))
end
    log("isCurrentPCBoxRefreshed: " .. tostring(result))
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/general-state/iscurrentpcboxrefreshed`</small>


## getServer()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getServer()
    log("getServer: " .. tostring(result))
end
    log("getServer: " .. tostring(result))
end
~~~

**Signature**

`result = getServer()`

Returns the connected server

**Practical scenario**

Use this query as a guard before an action that depends on the current global state.

```lua
function onPathAction()
    function onPathAction()
    local result = getServer()
    log("getServer: " .. tostring(result))
end
    log("getServer: " .. tostring(result))
end
```

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/general-state/getserver`</small>



# Team Pokémon

## getPokemonId()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonId(1)
    log("getPokemonId: " .. tostring(result))
end
    log("getPokemonId: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonId(index)`

Returns the ID of the specified pokémon in the team.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonId(1)
    log("getPokemonId: " .. tostring(result))
end
    log("getPokemonId: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/team-pok-mon/getpokemonid`</small>


## getPokemonName()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonName(1)
    log("getPokemonName: " .. tostring(result))
end
    log("getPokemonName: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonName(index)`

Returns the name of the specified pokémon in the team.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonName(1)
    log("getPokemonName: " .. tostring(result))
end
    log("getPokemonName: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/team-pok-mon/getpokemonname`</small>


## getPokemonHealth()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonHealth(1)
    log("getPokemonHealth: " .. tostring(result))
end
    log("getPokemonHealth: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonHealth(index)`

Returns the current health of the specified pokémon in the team.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonHealth(1)
    log("getPokemonHealth: " .. tostring(result))
end
    log("getPokemonHealth: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/team-pok-mon/getpokemonhealth`</small>


## getPokemonHealthPercent()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonHealthPercent(1)
    log("getPokemonHealthPercent: " .. tostring(result))
end
    log("getPokemonHealthPercent: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonHealthPercent(index)`

Returns the percentage of remaining health of the specified pokémon in the team.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonHealthPercent(1)
    log("getPokemonHealthPercent: " .. tostring(result))
end
    log("getPokemonHealthPercent: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/team-pok-mon/getpokemonhealthpercent`</small>


## getPokemonMaxHealth()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonMaxHealth(1)
    log("getPokemonMaxHealth: " .. tostring(result))
end
    log("getPokemonMaxHealth: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonMaxHealth(index)`

Returns the maximum health of the specified pokémon in the team.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonMaxHealth(1)
    log("getPokemonMaxHealth: " .. tostring(result))
end
    log("getPokemonMaxHealth: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/team-pok-mon/getpokemonmaxhealth`</small>


## getPokemonLevel()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonLevel(1)
    log("getPokemonLevel: " .. tostring(result))
end
    log("getPokemonLevel: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonLevel(index)`

Returns the level of the specified pokémon in the team.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonLevel(1)
    log("getPokemonLevel: " .. tostring(result))
end
    log("getPokemonLevel: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/team-pok-mon/getpokemonlevel`</small>


## getPokemonTotalExperience()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonTotalExperience(1)
    log("getPokemonTotalExperience: " .. tostring(result))
end
    log("getPokemonTotalExperience: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonTotalExperience(index)`

Returns the experience total of a pokemon level.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonTotalExperience(1)
    log("getPokemonTotalExperience: " .. tostring(result))
end
    log("getPokemonTotalExperience: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/team-pok-mon/getpokemontotalexperience`</small>


## getPokemonRemainingExperience()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonRemainingExperience(1)
    log("getPokemonRemainingExperience: " .. tostring(result))
end
    log("getPokemonRemainingExperience: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonRemainingExperience(index)`

Returns the remaining experience of a pokemon before next level.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonRemainingExperience(1)
    log("getPokemonRemainingExperience: " .. tostring(result))
end
    log("getPokemonRemainingExperience: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/team-pok-mon/getpokemonremainingexperience`</small>


## getPokemonStatus()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonStatus(1)
    log("getPokemonStatus: " .. tostring(result))
end
    log("getPokemonStatus: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonStatus(index)`

Returns the status of the specified pokémon in the team.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonStatus(1)
    log("getPokemonStatus: " .. tostring(result))
end
    log("getPokemonStatus: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/team-pok-mon/getpokemonstatus`</small>


## getPokemonForm()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonForm(1)
    log("getPokemonForm: " .. tostring(result))
end
    log("getPokemonForm: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonForm(index)`

Returns the form of the specified pokémon in the team (0 if no form).

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonForm(1)
    log("getPokemonForm: " .. tostring(result))
end
    log("getPokemonForm: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/team-pok-mon/getpokemonform`</small>


## getPokemonHeldItem()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonHeldItem(1)
    log("getPokemonHeldItem: " .. tostring(result))
end
    log("getPokemonHeldItem: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonHeldItem(index)`

Returns the item held by the specified pokemon in the team, null if empty.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonHeldItem(1)
    log("getPokemonHeldItem: " .. tostring(result))
end
    log("getPokemonHeldItem: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/team-pok-mon/getpokemonhelditem`</small>


## getPokemonUniqueId()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonUniqueId(1)
    log("getPokemonUniqueId: " .. tostring(result))
end
    log("getPokemonUniqueId: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonUniqueId(pokemonUid)`

PROCatchem unique ID of the pokemon of the current box matching the ID.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonUniqueId(1)
    log("getPokemonUniqueId: " .. tostring(result))
end
    log("getPokemonUniqueId: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `pokemonUid` | `integer` | yes | Stable Pokémon database/unique identifier returned by the corresponding query API. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/team-pok-mon/getpokemonuniqueid`</small>


## getPokemonMaxPowerPoints()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonMaxPowerPoints(1, "Tackle")
    log("getPokemonMaxPowerPoints: " .. tostring(result))
end
    log("getPokemonMaxPowerPoints: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonMaxPowerPoints(index, moveId)`

Max move PP of the pokemon of the current box matching the ID.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonMaxPowerPoints(1, "Tackle")
    log("getPokemonMaxPowerPoints: " .. tostring(result))
end
    log("getPokemonMaxPowerPoints: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |
| `moveId` | `integer` | yes | Value passed to the `moveId` parameter. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/team-pok-mon/getpokemonmaxpowerpoints`</small>


## isPokemonShiny()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isPokemonShiny(1)
    log("isPokemonShiny: " .. tostring(result))
end
    log("isPokemonShiny: " .. tostring(result))
end
~~~

**Signature**

`result = isPokemonShiny(index)`

Returns the shyniness of the specified pokémon in the team.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = isPokemonShiny(1)
    log("isPokemonShiny: " .. tostring(result))
end
    log("isPokemonShiny: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/team-pok-mon/ispokemonshiny`</small>


## getPokemonMoveName()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonMoveName(1, "Tackle")
    log("getPokemonMoveName: " .. tostring(result))
end
    log("getPokemonMoveName: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonMoveName(index, moveId)`

Returns the move of the specified pokémon in the team at the specified index.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonMoveName(1, "Tackle")
    log("getPokemonMoveName: " .. tostring(result))
end
    log("getPokemonMoveName: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |
| `moveId` | `integer` | yes | Value passed to the `moveId` parameter. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/team-pok-mon/getpokemonmovename`</small>


## getPokemonMoveAccuracy()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonMoveAccuracy(1, "Tackle")
    log("getPokemonMoveAccuracy: " .. tostring(result))
end
    log("getPokemonMoveAccuracy: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonMoveAccuracy(index, moveId)`

Returns the move accuracy of the specified pokémon in the team at the specified index.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonMoveAccuracy(1, "Tackle")
    log("getPokemonMoveAccuracy: " .. tostring(result))
end
    log("getPokemonMoveAccuracy: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |
| `moveId` | `integer` | yes | Value passed to the `moveId` parameter. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/team-pok-mon/getpokemonmoveaccuracy`</small>


## getPokemonMovePower()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonMovePower(1, "Tackle")
    log("getPokemonMovePower: " .. tostring(result))
end
    log("getPokemonMovePower: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonMovePower(index, moveId)`

Returns the move power of the specified pokémon in the team at the specified index.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonMovePower(1, "Tackle")
    log("getPokemonMovePower: " .. tostring(result))
end
    log("getPokemonMovePower: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |
| `moveId` | `integer` | yes | Value passed to the `moveId` parameter. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/team-pok-mon/getpokemonmovepower`</small>


## getPokemonMoveType()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonMoveType(1, "Tackle")
    log("getPokemonMoveType: " .. tostring(result))
end
    log("getPokemonMoveType: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonMoveType(index, moveId)`

Returns the move type of the specified pokémon in the team at the specified index.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonMoveType(1, "Tackle")
    log("getPokemonMoveType: " .. tostring(result))
end
    log("getPokemonMoveType: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |
| `moveId` | `integer` | yes | Value passed to the `moveId` parameter. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/team-pok-mon/getpokemonmovetype`</small>


## getPokemonMoveDamageType()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonMoveDamageType(1, "Tackle")
    log("getPokemonMoveDamageType: " .. tostring(result))
end
    log("getPokemonMoveDamageType: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonMoveDamageType(index, moveId)`

Returns the move damage type of the specified pokémon in the team at the specified index.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonMoveDamageType(1, "Tackle")
    log("getPokemonMoveDamageType: " .. tostring(result))
end
    log("getPokemonMoveDamageType: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |
| `moveId` | `integer` | yes | Value passed to the `moveId` parameter. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/team-pok-mon/getpokemonmovedamagetype`</small>


## getPokemonMoveStatus()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonMoveStatus(1, "Tackle")
    log("getPokemonMoveStatus: " .. tostring(result))
end
    log("getPokemonMoveStatus: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonMoveStatus(index, moveId)`

Returns true if the move of the specified pokémon in the team at the specified index can apply a status .

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonMoveStatus(1, "Tackle")
    log("getPokemonMoveStatus: " .. tostring(result))
end
    log("getPokemonMoveStatus: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |
| `moveId` | `integer` | yes | Value passed to the `moveId` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/team-pok-mon/getpokemonmovestatus`</small>


## getPokemonNature()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonNature(1)
    log("getPokemonNature: " .. tostring(result))
end
    log("getPokemonNature: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonNature(index)`

Nature of the pokemon of the current box matching the ID.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonNature(1)
    log("getPokemonNature: " .. tostring(result))
end
    log("getPokemonNature: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/team-pok-mon/getpokemonnature`</small>


## getPokemonAbility()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonAbility(1)
    log("getPokemonAbility: " .. tostring(result))
end
    log("getPokemonAbility: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonAbility(index)`

Ability of the pokemon of the current box matching the ID.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonAbility(1)
    log("getPokemonAbility: " .. tostring(result))
end
    log("getPokemonAbility: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/team-pok-mon/getpokemonability`</small>


## getPokemonStat()

~~~ lua
function onPathAction()
    local speed = getPokemonStat(1, "SPE")
    log("Lead Pokémon Speed: " .. tostring(speed))
end
~~~

**Signature**

`result = getPokemonStat(pokemonIndex, statType)`

Returns the value for the specified stat of the specified pokémon in the team.

**Practical scenario**

Read a current team stat by its documented stat key.

```lua
function onPathAction()
    local speed = getPokemonStat(1, "SPE")
    log("Lead Pokémon Speed: " .. tostring(speed))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `pokemonIndex` | `integer` | yes | One-based Pokémon index in the current team. |
| `statType` | `string` | yes | Stat name such as `HP`, `ATK`, `DEF`, `SPA`, `SPD`, or `SPE`. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/team-pok-mon/getpokemonstat`</small>


## getPokemonEffortValue()

~~~ lua
function onPathAction()
    local attackEV = getPokemonEffortValue(1, "ATK")
    if attackEV >= 252 then
        log("Attack EV training is complete.")
    end
end
~~~

**Signature**

`result = getPokemonEffortValue(pokemonIndex, statType)`

Returns the effort value for the specified stat of the specified pokémon in the team.

**Practical scenario**

Inspect a team Pokémon EV before deciding whether to keep training that stat.

```lua
function onPathAction()
    local attackEV = getPokemonEffortValue(1, "ATK")
    if attackEV >= 252 then
        log("Attack EV training is complete.")
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `pokemonIndex` | `integer` | yes | One-based Pokémon index in the current team. |
| `statType` | `string` | yes | Stat name such as `HP`, `ATK`, `DEF`, `SPA`, `SPD`, or `SPE`. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/team-pok-mon/getpokemoneffortvalue`</small>


## getPokemonIndividualValue()

~~~ lua
function onPathAction()
    local speedIV = getPokemonIndividualValue(1, "SPE")
    log("Lead Pokémon Speed IV: " .. tostring(speedIV))
end
~~~

**Signature**

`result = getPokemonIndividualValue(pokemonIndex, statType)`

Returns the individual value for the specified stat of the specified pokémon in the team.

**Practical scenario**

Inspect a team Pokémon IV when filtering catches or selecting a lead.

```lua
function onPathAction()
    local speedIV = getPokemonIndividualValue(1, "SPE")
    log("Lead Pokémon Speed IV: " .. tostring(speedIV))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `pokemonIndex` | `integer` | yes | One-based Pokémon index in the current team. |
| `statType` | `string` | yes | Stat name such as `HP`, `ATK`, `DEF`, `SPA`, `SPD`, or `SPE`. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/team-pok-mon/getpokemonindividualvalue`</small>


## getPokemonHappiness()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonHappiness(1)
    log("getPokemonHappiness: " .. tostring(result))
end
    log("getPokemonHappiness: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonHappiness(index)`

Returns the happiness of the specified pokémon in the team.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonHappiness(1)
    log("getPokemonHappiness: " .. tostring(result))
end
    log("getPokemonHappiness: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/team-pok-mon/getpokemonhappiness`</small>


## getPokemonRegion()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonRegion(1)
    log("getPokemonRegion: " .. tostring(result))
end
    log("getPokemonRegion: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonRegion(index)`

Returns the region of capture of the specified pokémon in the team.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonRegion(1)
    log("getPokemonRegion: " .. tostring(result))
end
    log("getPokemonRegion: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/team-pok-mon/getpokemonregion`</small>


## getPokemonOriginalTrainer()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonOriginalTrainer(1)
    log("getPokemonOriginalTrainer: " .. tostring(result))
end
    log("getPokemonOriginalTrainer: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonOriginalTrainer(index)`

Returns the original trainer of the specified pokémon in the team.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonOriginalTrainer(1)
    log("getPokemonOriginalTrainer: " .. tostring(result))
end
    log("getPokemonOriginalTrainer: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/team-pok-mon/getpokemonoriginaltrainer`</small>


## getPokemonGender()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonGender(1)
    log("getPokemonGender: " .. tostring(result))
end
    log("getPokemonGender: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonGender(index)`

Returns the gender of the specified pokémon in the team.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonGender(1)
    log("getPokemonGender: " .. tostring(result))
end
    log("getPokemonGender: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/team-pok-mon/getpokemongender`</small>


## getPokemonType()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getPokemonType(1)
    log("getPokemonType: " .. tostring(result))
end
    log("getPokemonType: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonType(index)`

Returns the type of the specified pokémon in the team as an array of length 2.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getPokemonType(1)
    log("getPokemonType: " .. tostring(result))
end
    log("getPokemonType: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`array<string>` — example: `[]`

<small>Source key: `POST /lua/team-pok-mon/getpokemontype`</small>


## getDamageMultiplier()

~~~ lua
function onBattleAction()
    local opponentTypes = getOpponentType()
    local multiplier = getDamageMultiplier("ELECTRIC", opponentTypes)

    if multiplier >= 2 then
        useMove("Thunderbolt")
    else
        attack()
    end
end
~~~

**Signature**

`result = getDamageMultiplier(attacker, ...)`

Returns the multiplier of the damage type between an attacking type and one or two defending types.

**Practical scenario**

Compare one attacking type against the opponent's one or two defending types.

```lua
function onBattleAction()
    local opponentTypes = getOpponentType()
    local multiplier = getDamageMultiplier("ELECTRIC", opponentTypes)

    if multiplier >= 2 then
        useMove("Thunderbolt")
    else
        attack()
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `attacker` | `string` | yes | Value passed to the `attacker` parameter. |
| `defender` | `array<LuaValue>` | yes | Value passed to the `defender` parameter. |

### Returns

`number` — example: `1.0`

<small>Source key: `POST /lua/team-pok-mon/getdamagemultiplier`</small>


## isPokemonUsable()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isPokemonUsable(1)
    log("isPokemonUsable: " .. tostring(result))
end
    log("isPokemonUsable: " .. tostring(result))
end
~~~

**Signature**

`result = isPokemonUsable(index)`

Returns true if the specified pokémon has is alive and has an offensive attack available.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = isPokemonUsable(1)
    log("isPokemonUsable: " .. tostring(result))
end
    log("isPokemonUsable: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/team-pok-mon/ispokemonusable`</small>


## getUsablePokemonCount()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getUsablePokemonCount()
    log("getUsablePokemonCount: " .. tostring(result))
end
    log("getUsablePokemonCount: " .. tostring(result))
end
~~~

**Signature**

`result = getUsablePokemonCount()`

Returns the amount of usable pokémon in the team.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = getUsablePokemonCount()
    log("getUsablePokemonCount: " .. tostring(result))
end
    log("getUsablePokemonCount: " .. tostring(result))
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/team-pok-mon/getusablepokemoncount`</small>


## hasMove()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = hasMove(1, "Tackle")
    log("hasMove: " .. tostring(result))
end
    log("hasMove: " .. tostring(result))
end
~~~

**Signature**

`result = hasMove(pokemonIndex, moveName)`

Returns true if the specified pokémon has a move with the specified name.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = hasMove(1, "Tackle")
    log("hasMove: " .. tostring(result))
end
    log("hasMove: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `pokemonIndex` | `integer` | yes | One-based Pokémon index in the current team. |
| `moveName` | `string` | yes | Exact move name as shown by the game. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/team-pok-mon/hasmove`</small>


## hasPokemonInTeam()

~~~ lua
function onPathAction()
    if not hasPokemonInTeam("Pikachu") then
        fatal("Put Pikachu in the team before starting this route.")
        return
    end

    moveToGrass()
end
~~~

**Signature**

`result = hasPokemonInTeam(pokemonName)`

Returns true if the specified pokémon is present in the team.

**Practical scenario**

Guard routes that require a specific Pokémon in the current team.

```lua
function onPathAction()
    if not hasPokemonInTeam("Pikachu") then
        fatal("Put Pikachu in the team before starting this route.")
        return
    end

    moveToGrass()
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `pokemonName` | `string` | yes | Value passed to the `pokemonName` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/team-pok-mon/haspokemoninteam`</small>


## isTeamSortedByLevelAscending()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isTeamSortedByLevelAscending()
    log("isTeamSortedByLevelAscending: " .. tostring(result))
end
    log("isTeamSortedByLevelAscending: " .. tostring(result))
end
~~~

**Signature**

`result = isTeamSortedByLevelAscending()`

Returns true if the team is sorted by level in ascending order.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = isTeamSortedByLevelAscending()
    log("isTeamSortedByLevelAscending: " .. tostring(result))
end
    log("isTeamSortedByLevelAscending: " .. tostring(result))
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/team-pok-mon/isteamsortedbylevelascending`</small>


## isTeamSortedByLevelDescending()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isTeamSortedByLevelDescending()
    log("isTeamSortedByLevelDescending: " .. tostring(result))
end
    log("isTeamSortedByLevelDescending: " .. tostring(result))
end
~~~

**Signature**

`result = isTeamSortedByLevelDescending()`

Returns true if the team is sorted by level in descending order.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = isTeamSortedByLevelDescending()
    log("isTeamSortedByLevelDescending: " .. tostring(result))
end
    log("isTeamSortedByLevelDescending: " .. tostring(result))
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/team-pok-mon/isteamsortedbyleveldescending`</small>


## isTeamRangeSortedByLevelAscending()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isTeamRangeSortedByLevelAscending(10, 10)
    log("isTeamRangeSortedByLevelAscending: " .. tostring(result))
end
    log("isTeamRangeSortedByLevelAscending: " .. tostring(result))
end
~~~

**Signature**

`result = isTeamRangeSortedByLevelAscending(fromIndex, toIndex)`

Returns true if the specified part of the team is sorted by level in ascending order.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = isTeamRangeSortedByLevelAscending(10, 10)
    log("isTeamRangeSortedByLevelAscending: " .. tostring(result))
end
    log("isTeamRangeSortedByLevelAscending: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `fromIndex` | `integer` | yes | Value passed to the `fromIndex` parameter. |
| `toIndex` | `integer` | yes | Value passed to the `toIndex` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/team-pok-mon/isteamrangesortedbylevelascending`</small>


## isTeamRangeSortedByLevelDescending()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = isTeamRangeSortedByLevelDescending(10, 10)
    log("isTeamRangeSortedByLevelDescending: " .. tostring(result))
end
    log("isTeamRangeSortedByLevelDescending: " .. tostring(result))
end
~~~

**Signature**

`result = isTeamRangeSortedByLevelDescending(fromIndex, toIndex)`

Returns true if the specified part of the team the team is sorted by level in descending order.

**Practical scenario**

Use this query to make team decisions before selecting a path or battle action.

```lua
function onPathAction()
    function onPathAction()
    local result = isTeamRangeSortedByLevelDescending(10, 10)
    log("isTeamRangeSortedByLevelDescending: " .. tostring(result))
end
    log("isTeamRangeSortedByLevelDescending: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `fromIndex` | `integer` | yes | Value passed to the `fromIndex` parameter. |
| `toIndex` | `integer` | yes | Value passed to the `toIndex` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/team-pok-mon/isteamrangesortedbyleveldescending`</small>



# Items and shop

## hasItem()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = hasItem("Potion")
    if result then
        log("hasItem condition is true")
    end
end
    if result then
        log("hasItem condition is true")
    end
end
~~~

**Signature**

`result = hasItem(itemName)`

Returns true if the specified item is in the inventory.

**Practical scenario**

Use this query to guard an item or shop action and avoid sending requests that cannot succeed.

```lua
function onPathAction()
    function onPathAction()
    local result = hasItem("Potion")
    if result then
        log("hasItem condition is true")
    end
end
    if result then
        log("hasItem condition is true")
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `itemName` | `string` | yes | Exact item name as shown in the inventory. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/items-and-shop/hasitem`</small>


## getItemQuantity()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getItemQuantity("Potion")
    if result then
        log("getItemQuantity condition is true")
    end
end
    if result then
        log("getItemQuantity condition is true")
    end
end
~~~

**Signature**

`result = getItemQuantity(itemName)`

Returns the quantity of the specified item in the inventory.

**Practical scenario**

Use this query to guard an item or shop action and avoid sending requests that cannot succeed.

```lua
function onPathAction()
    function onPathAction()
    local result = getItemQuantity("Potion")
    if result then
        log("getItemQuantity condition is true")
    end
end
    if result then
        log("getItemQuantity condition is true")
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `itemName` | `string` | yes | Exact item name as shown in the inventory. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/items-and-shop/getitemquantity`</small>


## hasItemId()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = hasItemId("Potion")
    if result then
        log("hasItemId condition is true")
    end
end
    if result then
        log("hasItemId condition is true")
    end
end
~~~

**Signature**

`result = hasItemId(itemid)`

Returns true if the specified item is in the inventory.

**Practical scenario**

Use this query to guard an item or shop action and avoid sending requests that cannot succeed.

```lua
function onPathAction()
    function onPathAction()
    local result = hasItemId("Potion")
    if result then
        log("hasItemId condition is true")
    end
end
    if result then
        log("hasItemId condition is true")
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `itemid` | `integer` | yes | Value passed to the `itemid` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/items-and-shop/hasitemid`</small>


## getItemQuantityId()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getItemQuantityId("Potion")
    if result then
        log("getItemQuantityId condition is true")
    end
end
    if result then
        log("getItemQuantityId condition is true")
    end
end
~~~

**Signature**

`result = getItemQuantityId(itemid)`

Returns the quantity of the specified item in the inventory.

**Practical scenario**

Use this query to guard an item or shop action and avoid sending requests that cannot succeed.

```lua
function onPathAction()
    function onPathAction()
    local result = getItemQuantityId("Potion")
    if result then
        log("getItemQuantityId condition is true")
    end
end
    if result then
        log("getItemQuantityId condition is true")
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `itemid` | `integer` | yes | Value passed to the `itemid` parameter. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/items-and-shop/getitemquantityid`</small>


## buyItem()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = buyItem("Potion", 15)
    return
end
    return
end
~~~

**Signature**

`result = buyItem(itemName, quantity)`

Buys the specified item from the opened shop.

**Practical scenario**

Check inventory/shop state first, perform this action once, then return so the server can update state.

```lua
function onPathAction()
    function onPathAction()
    local result = buyItem("Potion", 15)
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `itemName` | `string` | yes | Exact item name as shown in the inventory. |
| `quantity` | `integer` | yes | Value passed to the `quantity` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/items-and-shop/buyitem`</small>


## hasShopItem()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = hasShopItem("Potion")
    if result then
        log("hasShopItem condition is true")
    end
end
    if result then
        log("hasShopItem condition is true")
    end
end
~~~

**Signature**

`result = hasShopItem(itemName)`

Lua function `hasShopItem`.

**Practical scenario**

Use this query to guard an item or shop action and avoid sending requests that cannot succeed.

```lua
function onPathAction()
    function onPathAction()
    local result = hasShopItem("Potion")
    if result then
        log("hasShopItem condition is true")
    end
end
    if result then
        log("hasShopItem condition is true")
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `itemName` | `string` | yes | Exact item name as shown in the inventory. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/items-and-shop/hasshopitem`</small>


## giveItemToPokemon()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = giveItemToPokemon("Potion", 1)
    return
end
    return
end
~~~

**Signature**

`result = giveItemToPokemon(itemName, pokemonIndex)`

Give the specified item on the specified pokemon.

**Practical scenario**

Check inventory/shop state first, perform this action once, then return so the server can update state.

```lua
function onPathAction()
    function onPathAction()
    local result = giveItemToPokemon("Potion", 1)
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `itemName` | `string` | yes | Exact item name as shown in the inventory. |
| `pokemonIndex` | `integer` | yes | One-based Pokémon index in the current team. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/items-and-shop/giveitemtopokemon`</small>


## takeItemFromPokemon()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = takeItemFromPokemon(1)
    return
end
    return
end
~~~

**Signature**

`result = takeItemFromPokemon(index)`

Take the held item from the specified pokemon.

**Practical scenario**

Check inventory/shop state first, perform this action once, then return so the server can update state.

```lua
function onPathAction()
    function onPathAction()
    local result = takeItemFromPokemon(1)
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/items-and-shop/takeitemfrompokemon`</small>


## useItem()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = useItem("Potion")
    return
end
    return
end
~~~

**Signature**

`result = useItem(itemName)`

Uses the specified item.

**Practical scenario**

Check inventory/shop state first, perform this action once, then return so the server can update state.

```lua
function onPathAction()
    function onPathAction()
    local result = useItem("Potion")
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `itemName` | `string` | yes | Exact item name as shown in the inventory. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/items-and-shop/useitem`</small>


## useItemOnPokemon()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = useItemOnPokemon("Potion", 1)
    return
end
    return
end
~~~

**Signature**

`result = useItemOnPokemon(itemName, pokemonIndex)`

Uses the specified item on the specified pokémon.

**Practical scenario**

Check inventory/shop state first, perform this action once, then return so the server can update state.

```lua
function onPathAction()
    function onPathAction()
    local result = useItemOnPokemon("Potion", 1)
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `itemName` | `string` | yes | Exact item name as shown in the inventory. |
| `pokemonIndex` | `integer` | yes | One-based Pokémon index in the current team. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/items-and-shop/useitemonpokemon`</small>



# PC storage

## getCurrentPCBoxId()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getCurrentPCBoxId()
    log("getCurrentPCBoxId: " .. tostring(result))
end
    log("getCurrentPCBoxId: " .. tostring(result))
end
~~~

**Signature**

`result = getCurrentPCBoxId()`

Get the active PC Box.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getCurrentPCBoxId()
    log("getCurrentPCBoxId: " .. tostring(result))
end
    log("getCurrentPCBoxId: " .. tostring(result))
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getcurrentpcboxid`</small>


## isPCOpen()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = isPCOpen()
    log("isPCOpen: " .. tostring(result))
end
    log("isPCOpen: " .. tostring(result))
end
~~~

**Signature**

`result = isPCOpen()`

Check if the PC is open. Moving close the PC, usePC() opens it.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = isPCOpen()
    log("isPCOpen: " .. tostring(result))
end
    log("isPCOpen: " .. tostring(result))
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/pc-storage/ispcopen`</small>


## getCurrentPCBoxSize()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getCurrentPCBoxSize()
    log("getCurrentPCBoxSize: " .. tostring(result))
end
    log("getCurrentPCBoxSize: " .. tostring(result))
end
~~~

**Signature**

`result = getCurrentPCBoxSize()`

Returns the number of Pokémon currently cached in the visible PC box. PC boxes can hold up to 30 slots; use this as the safe upper bound for one-based `boxPokemonId` indexes after the box is refreshed.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getCurrentPCBoxSize()
    log("getCurrentPCBoxSize: " .. tostring(result))
end
    log("getCurrentPCBoxSize: " .. tostring(result))
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getcurrentpcboxsize`</small>


## getPCBoxCount()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPCBoxCount()
    log("getPCBoxCount: " .. tostring(result))
end
    log("getPCBoxCount: " .. tostring(result))
end
~~~

**Signature**

`result = getPCBoxCount()`

Return the number of non-empty boxes in the PC

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPCBoxCount()
    log("getPCBoxCount: " .. tostring(result))
end
    log("getPCBoxCount: " .. tostring(result))
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getpcboxcount`</small>


## getPCPokemonCount()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPCPokemonCount()
    log("getPCPokemonCount: " .. tostring(result))
end
    log("getPCPokemonCount: " .. tostring(result))
end
~~~

**Signature**

`result = getPCPokemonCount()`

Returns the latest known total Pokémon count for the current PC storage view. The value is read from server PC metadata when available and should not be inferred from internal slot IDs.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPCPokemonCount()
    log("getPCPokemonCount: " .. tostring(result))
end
    log("getPCPokemonCount: " .. tostring(result))
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getpcpokemoncount`</small>


## getPokemonIdFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonIdFromPC(1, 1)
    log("getPokemonIdFromPC: " .. tostring(result))
end
    log("getPokemonIdFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonIdFromPC(boxId, boxPokemonId)`

Pokedex ID of the pokemon of the current box matching the ID.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonIdFromPC(1, 1)
    log("getPokemonIdFromPC: " .. tostring(result))
end
    log("getPokemonIdFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getpokemonidfrompc`</small>


## getPokemonNameFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonNameFromPC(1, 1)
    log("getPokemonNameFromPC: " .. tostring(result))
end
    log("getPokemonNameFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonNameFromPC(boxId, boxPokemonId)`

Name of the pokemon of the current box matching the ID.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonNameFromPC(1, 1)
    log("getPokemonNameFromPC: " .. tostring(result))
end
    log("getPokemonNameFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/pc-storage/getpokemonnamefrompc`</small>


## getPokemonHealthFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonHealthFromPC(1, 1)
    log("getPokemonHealthFromPC: " .. tostring(result))
end
    log("getPokemonHealthFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonHealthFromPC(boxId, boxPokemonId)`

Current HP of the pokemon of the current box matching the ID.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonHealthFromPC(1, 1)
    log("getPokemonHealthFromPC: " .. tostring(result))
end
    log("getPokemonHealthFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getpokemonhealthfrompc`</small>


## getPokemonHealthPercentFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonHealthPercentFromPC(1, 1)
    log("getPokemonHealthPercentFromPC: " .. tostring(result))
end
    log("getPokemonHealthPercentFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonHealthPercentFromPC(boxId, boxPokemonId)`

Returns the percentage of remaining health of the specified pokémon in the team.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonHealthPercentFromPC(1, 1)
    log("getPokemonHealthPercentFromPC: " .. tostring(result))
end
    log("getPokemonHealthPercentFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getpokemonhealthpercentfrompc`</small>


## getPokemonMaxHealthFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonMaxHealthFromPC(1, 1)
    log("getPokemonMaxHealthFromPC: " .. tostring(result))
end
    log("getPokemonMaxHealthFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonMaxHealthFromPC(boxId, boxPokemonId)`

Max HP of the pokemon of the current box matching the ID.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonMaxHealthFromPC(1, 1)
    log("getPokemonMaxHealthFromPC: " .. tostring(result))
end
    log("getPokemonMaxHealthFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getpokemonmaxhealthfrompc`</small>


## getPokemonLevelFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonLevelFromPC(1, 1)
    log("getPokemonLevelFromPC: " .. tostring(result))
end
    log("getPokemonLevelFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonLevelFromPC(boxId, boxPokemonId)`

Level of the pokemon of the current box matching the ID.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonLevelFromPC(1, 1)
    log("getPokemonLevelFromPC: " .. tostring(result))
end
    log("getPokemonLevelFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getpokemonlevelfrompc`</small>


## getPokemonTotalExperienceFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonTotalExperienceFromPC(1, 1)
    log("getPokemonTotalExperienceFromPC: " .. tostring(result))
end
    log("getPokemonTotalExperienceFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonTotalExperienceFromPC(boxId, boxPokemonId)`

Total of experience cost of a level for the pokemon of the current box matching the ID.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonTotalExperienceFromPC(1, 1)
    log("getPokemonTotalExperienceFromPC: " .. tostring(result))
end
    log("getPokemonTotalExperienceFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getpokemontotalexperiencefrompc`</small>


## getPokemonRemainingExperienceFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonRemainingExperienceFromPC(1, 1)
    log("getPokemonRemainingExperienceFromPC: " .. tostring(result))
end
    log("getPokemonRemainingExperienceFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonRemainingExperienceFromPC(boxId, boxPokemonId)`

Remaining experience before the next level of the pokemon of the current box matching the ID.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonRemainingExperienceFromPC(1, 1)
    log("getPokemonRemainingExperienceFromPC: " .. tostring(result))
end
    log("getPokemonRemainingExperienceFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getpokemonremainingexperiencefrompc`</small>


## getPokemonStatusFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonStatusFromPC(1, 1)
    log("getPokemonStatusFromPC: " .. tostring(result))
end
    log("getPokemonStatusFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonStatusFromPC(boxId, boxPokemonId)`

Status of the pokemon of the current box matching the ID.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonStatusFromPC(1, 1)
    log("getPokemonStatusFromPC: " .. tostring(result))
end
    log("getPokemonStatusFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/pc-storage/getpokemonstatusfrompc`</small>


## getPokemonTypeFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonTypeFromPC(1, 1)
    log("getPokemonTypeFromPC: " .. tostring(result))
end
    log("getPokemonTypeFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonTypeFromPC(boxId, boxPokemonId)`

Type of the pokemon of the current box matching the ID as an array of length 2.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonTypeFromPC(1, 1)
    log("getPokemonTypeFromPC: " .. tostring(result))
end
    log("getPokemonTypeFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`array<string>` — example: `[]`

<small>Source key: `POST /lua/pc-storage/getpokemontypefrompc`</small>


## getPokemonHeldItemFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonHeldItemFromPC(1, 1)
    log("getPokemonHeldItemFromPC: " .. tostring(result))
end
    log("getPokemonHeldItemFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonHeldItemFromPC(boxId, boxPokemonId)`

Returns the item held by the specified pokemon in the PC, null if empty.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonHeldItemFromPC(1, 1)
    log("getPokemonHeldItemFromPC: " .. tostring(result))
end
    log("getPokemonHeldItemFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/pc-storage/getpokemonhelditemfrompc`</small>


## getPokemonUniqueIdFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonUniqueIdFromPC(1, 1)
    log("getPokemonUniqueIdFromPC: " .. tostring(result))
end
    log("getPokemonUniqueIdFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonUniqueIdFromPC(boxId, boxPokemonId)`

PROCatchem custom unique ID of the pokemon of the current box matching the ID.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonUniqueIdFromPC(1, 1)
    log("getPokemonUniqueIdFromPC: " .. tostring(result))
end
    log("getPokemonUniqueIdFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getpokemonuniqueidfrompc`</small>


## getPokemonRemainingPowerPointsFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonRemainingPowerPointsFromPC(1, 1, "Tackle")
    log("getPokemonRemainingPowerPointsFromPC: " .. tostring(result))
end
    log("getPokemonRemainingPowerPointsFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonRemainingPowerPointsFromPC(boxId, boxPokemonId, moveId)`

Current move PP of the pokemon of the current box matching the ID.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonRemainingPowerPointsFromPC(1, 1, "Tackle")
    log("getPokemonRemainingPowerPointsFromPC: " .. tostring(result))
end
    log("getPokemonRemainingPowerPointsFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |
| `moveId` | `integer` | yes | Value passed to the `moveId` parameter. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getpokemonremainingpowerpointsfrompc`</small>


## getPokemonMaxPowerPointsFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonMaxPowerPointsFromPC(1, 1, "Tackle")
    log("getPokemonMaxPowerPointsFromPC: " .. tostring(result))
end
    log("getPokemonMaxPowerPointsFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonMaxPowerPointsFromPC(boxId, boxPokemonId, moveId)`

Max move PP of the pokemon of the current box matching the ID.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonMaxPowerPointsFromPC(1, 1, "Tackle")
    log("getPokemonMaxPowerPointsFromPC: " .. tostring(result))
end
    log("getPokemonMaxPowerPointsFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |
| `moveId` | `integer` | yes | Value passed to the `moveId` parameter. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getpokemonmaxpowerpointsfrompc`</small>


## isPokemonFromPCShiny()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = isPokemonFromPCShiny(1, 1)
    log("isPokemonFromPCShiny: " .. tostring(result))
end
    log("isPokemonFromPCShiny: " .. tostring(result))
end
~~~

**Signature**

`result = isPokemonFromPCShiny(boxId, boxPokemonId)`

Shyniness of the pokemon of the current box matching the ID.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = isPokemonFromPCShiny(1, 1)
    log("isPokemonFromPCShiny: " .. tostring(result))
end
    log("isPokemonFromPCShiny: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/pc-storage/ispokemonfrompcshiny`</small>


## getPokemonMoveNameFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonMoveNameFromPC(1, 1, "Tackle")
    log("getPokemonMoveNameFromPC: " .. tostring(result))
end
    log("getPokemonMoveNameFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonMoveNameFromPC(boxId, boxPokemonId, moveId)`

Move of the pokemon of the current box matching the ID.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonMoveNameFromPC(1, 1, "Tackle")
    log("getPokemonMoveNameFromPC: " .. tostring(result))
end
    log("getPokemonMoveNameFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |
| `moveId` | `integer` | yes | Value passed to the `moveId` parameter. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/pc-storage/getpokemonmovenamefrompc`</small>


## getPokemonMoveAccuracyFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonMoveAccuracyFromPC(1, 1, "Tackle")
    log("getPokemonMoveAccuracyFromPC: " .. tostring(result))
end
    log("getPokemonMoveAccuracyFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonMoveAccuracyFromPC(boxId, boxPokemonId, moveId)`

Returns the move accuracy of the specified pokémon in the box at the specified index.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonMoveAccuracyFromPC(1, 1, "Tackle")
    log("getPokemonMoveAccuracyFromPC: " .. tostring(result))
end
    log("getPokemonMoveAccuracyFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |
| `moveId` | `integer` | yes | Value passed to the `moveId` parameter. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getpokemonmoveaccuracyfrompc`</small>


## getPokemonMovePowerFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonMovePowerFromPC(1, 1, "Tackle")
    log("getPokemonMovePowerFromPC: " .. tostring(result))
end
    log("getPokemonMovePowerFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonMovePowerFromPC(boxId, boxPokemonId, moveId)`

Returns the move power of the specified pokémon in the box at the specified index.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonMovePowerFromPC(1, 1, "Tackle")
    log("getPokemonMovePowerFromPC: " .. tostring(result))
end
    log("getPokemonMovePowerFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |
| `moveId` | `integer` | yes | Value passed to the `moveId` parameter. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getpokemonmovepowerfrompc`</small>


## getPokemonMoveTypeFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonMoveTypeFromPC(1, 1, "Tackle")
    log("getPokemonMoveTypeFromPC: " .. tostring(result))
end
    log("getPokemonMoveTypeFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonMoveTypeFromPC(boxId, boxPokemonId, moveId)`

Returns the move type of the specified pokémon in the box at the specified index.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonMoveTypeFromPC(1, 1, "Tackle")
    log("getPokemonMoveTypeFromPC: " .. tostring(result))
end
    log("getPokemonMoveTypeFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |
| `moveId` | `integer` | yes | Value passed to the `moveId` parameter. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/pc-storage/getpokemonmovetypefrompc`</small>


## getPokemonMoveDamageTypeFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonMoveDamageTypeFromPC(1, 1, "Tackle")
    log("getPokemonMoveDamageTypeFromPC: " .. tostring(result))
end
    log("getPokemonMoveDamageTypeFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonMoveDamageTypeFromPC(boxId, boxPokemonId, moveId)`

Returns the move damage type of the specified pokémon in the box at the specified index.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonMoveDamageTypeFromPC(1, 1, "Tackle")
    log("getPokemonMoveDamageTypeFromPC: " .. tostring(result))
end
    log("getPokemonMoveDamageTypeFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |
| `moveId` | `integer` | yes | Value passed to the `moveId` parameter. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/pc-storage/getpokemonmovedamagetypefrompc`</small>


## getPokemonMoveStatusFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonMoveStatusFromPC(1, 1, "Tackle")
    log("getPokemonMoveStatusFromPC: " .. tostring(result))
end
    log("getPokemonMoveStatusFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonMoveStatusFromPC(boxId, boxPokemonId, moveId)`

Returns true if the move of the specified pokémon in the box at the specified index can apply a status .

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonMoveStatusFromPC(1, 1, "Tackle")
    log("getPokemonMoveStatusFromPC: " .. tostring(result))
end
    log("getPokemonMoveStatusFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |
| `moveId` | `integer` | yes | Value passed to the `moveId` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/pc-storage/getpokemonmovestatusfrompc`</small>


## getPokemonNatureFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonNatureFromPC(1, 1)
    log("getPokemonNatureFromPC: " .. tostring(result))
end
    log("getPokemonNatureFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonNatureFromPC(boxId, boxPokemonId)`

Nature of the pokemon of the current box matching the ID.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonNatureFromPC(1, 1)
    log("getPokemonNatureFromPC: " .. tostring(result))
end
    log("getPokemonNatureFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/pc-storage/getpokemonnaturefrompc`</small>


## getPokemonAbilityFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonAbilityFromPC(1, 1)
    log("getPokemonAbilityFromPC: " .. tostring(result))
end
    log("getPokemonAbilityFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonAbilityFromPC(boxId, boxPokemonId)`

Ability of the pokemon of the current box matching the ID.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonAbilityFromPC(1, 1)
    log("getPokemonAbilityFromPC: " .. tostring(result))
end
    log("getPokemonAbilityFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/pc-storage/getpokemonabilityfrompc`</small>


## getPokemonStatFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local speed = getPokemonStatFromPC(1, 1, "SPE")
    log("Box 1 slot 1 Speed: " .. tostring(speed))
end
~~~

**Signature**

`result = getPokemonStatFromPC(boxId, boxPokemonId, statType)`

Returns the value for the specified stat of the specified pokémon in the PC.

**Practical scenario**

Open and refresh the PC before reading a stored Pokémon stat.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local speed = getPokemonStatFromPC(1, 1, "SPE")
    log("Box 1 slot 1 Speed: " .. tostring(speed))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |
| `statType` | `string` | yes | Stat name such as `HP`, `ATK`, `DEF`, `SPA`, `SPD`, or `SPE`. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getpokemonstatfrompc`</small>


## getPokemonEffortValueFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local attackEV = getPokemonEffortValueFromPC(1, 1, "ATK")
    log("Stored Pokémon Attack EV: " .. tostring(attackEV))
end
~~~

**Signature**

`result = getPokemonEffortValueFromPC(boxId, boxPokemonId, statType)`

Returns the effort value for the specified stat of the specified pokémon in the PC.

**Practical scenario**

Read EVs from a refreshed PC entry before selecting a Pokémon to withdraw.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local attackEV = getPokemonEffortValueFromPC(1, 1, "ATK")
    log("Stored Pokémon Attack EV: " .. tostring(attackEV))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |
| `statType` | `string` | yes | Stat name such as `HP`, `ATK`, `DEF`, `SPA`, `SPD`, or `SPE`. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getpokemoneffortvaluefrompc`</small>


## getPokemonIndividualValueFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local speedIV = getPokemonIndividualValueFromPC(1, 1, "SPE")
    log("Stored Pokémon Speed IV: " .. tostring(speedIV))
end
~~~

**Signature**

`result = getPokemonIndividualValueFromPC(boxId, boxPokemonId, statType)`

Returns the individual value for the specified stat of the specified pokémon in the PC.

**Practical scenario**

Read IVs from a refreshed PC entry when filtering stored catches.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local speedIV = getPokemonIndividualValueFromPC(1, 1, "SPE")
    log("Stored Pokémon Speed IV: " .. tostring(speedIV))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |
| `statType` | `string` | yes | Stat name such as `HP`, `ATK`, `DEF`, `SPA`, `SPD`, or `SPE`. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getpokemonindividualvaluefrompc`</small>


## getPokemonHappinessFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonHappinessFromPC(1, 1)
    log("getPokemonHappinessFromPC: " .. tostring(result))
end
    log("getPokemonHappinessFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonHappinessFromPC(boxId, boxPokemonId)`

Happiness of the pokemon of the current box matching the ID.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonHappinessFromPC(1, 1)
    log("getPokemonHappinessFromPC: " .. tostring(result))
end
    log("getPokemonHappinessFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getpokemonhappinessfrompc`</small>


## getPokemonRegionFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonRegionFromPC(1, 1)
    log("getPokemonRegionFromPC: " .. tostring(result))
end
    log("getPokemonRegionFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonRegionFromPC(boxId, boxPokemonId)`

Region of capture of the pokemon of the current box matching the ID.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonRegionFromPC(1, 1)
    log("getPokemonRegionFromPC: " .. tostring(result))
end
    log("getPokemonRegionFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/pc-storage/getpokemonregionfrompc`</small>


## getPokemonOriginalTrainerFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonOriginalTrainerFromPC(1, 1)
    log("getPokemonOriginalTrainerFromPC: " .. tostring(result))
end
    log("getPokemonOriginalTrainerFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonOriginalTrainerFromPC(boxId, boxPokemonId)`

Original trainer of the pokemon of the current box matching the ID.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonOriginalTrainerFromPC(1, 1)
    log("getPokemonOriginalTrainerFromPC: " .. tostring(result))
end
    log("getPokemonOriginalTrainerFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/pc-storage/getpokemonoriginaltrainerfrompc`</small>


## getPokemonGenderFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonGenderFromPC(1, 1)
    log("getPokemonGenderFromPC: " .. tostring(result))
end
    log("getPokemonGenderFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonGenderFromPC(boxId, boxPokemonId)`

Gender of the pokemon of the current box matching the ID.

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonGenderFromPC(1, 1)
    log("getPokemonGenderFromPC: " .. tostring(result))
end
    log("getPokemonGenderFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/pc-storage/getpokemongenderfrompc`</small>


## getPokemonFormFromPC()

~~~ lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonFormFromPC(1, 1)
    log("getPokemonFormFromPC: " .. tostring(result))
end
    log("getPokemonFormFromPC: " .. tostring(result))
end
~~~

**Signature**

`result = getPokemonFormFromPC(boxId, boxPokemonId)`

Form of the pokémon in the current box matching the ID. (0 if no form)

**Practical scenario**

Read this value only after the PC is open and the selected box is refreshed.

```lua
function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    function inspectPC()
    if not isPCOpen() or not isCurrentPCBoxRefreshed() then
        return
    end

    local result = getPokemonFormFromPC(1, 1)
    log("getPokemonFormFromPC: " .. tostring(result))
end
    log("getPokemonFormFromPC: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/pc-storage/getpokemonformfrompc`</small>


## usePC()

~~~ lua
function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    local result = usePC()
    return
end
    return
end
~~~

**Signature**

`result = usePC()`

Move next to the map PC when needed, open Pokémon Storage, and request the current PC box. The PC opens using the official storage flow and remains open until closed by movement or another PC action. Use `isCurrentPCBoxRefreshed()` before relying on the refreshed box contents.

**Practical scenario**

PC actions are asynchronous. Issue one operation, return, and wait for the next server refresh before making a dependent change.

```lua
function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    local result = usePC()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/pc-storage/usepc`</small>


## openPCBox()

~~~ lua
function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    local result = openPCBox(1)
    return
end
    return
end
~~~

**Signature**

`result = openPCBox(boxId)`

Open or refresh a PC box by its one-based box number. The visible box order uses one-based `boxPokemonId` indexes, while the tool internally tracks server database IDs and PC slot IDs. Wait for `isCurrentPCBoxRefreshed()` before reading the box immediately after opening it.

**Practical scenario**

PC actions are asynchronous. Issue one operation, return, and wait for the next server refresh before making a dependent change.

```lua
function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    local result = openPCBox(1)
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/pc-storage/openpcbox`</small>


## depositPokemonToPC()

~~~ lua
function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    local result = depositPokemonToPC(2)
    return
end
    return
end
~~~

**Signature**

`result = depositPokemonToPC(teamPokemonId)`

Send the Pokémon at the one-based team index into the currently open PC box. The tool resolves the selected team Pokémon to its server database ID and waits for the server PC delta update instead of forcing an immediate full refresh. Re-check team/PC state before issuing a dependent action.

**Practical scenario**

PC actions are asynchronous. Issue one operation, return, and wait for the next server refresh before making a dependent change.

```lua
function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    local result = depositPokemonToPC(2)
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `teamPokemonId` | `integer` | yes | Value passed to the `teamPokemonId` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/pc-storage/depositpokemontopc`</small>


## withdrawPokemonFromPC()

~~~ lua
function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    local result = withdrawPokemonFromPC(1, 1)
    return
end
    return
end
~~~

**Signature**

`result = withdrawPokemonFromPC(boxId, boxPokemonId)`

Move the Pokémon at the one-based PC box index into the team. The tool resolves the selected PC Pokémon to its server database ID and waits for the normal team update plus PC delta remove response. The target `boxId` should match the visible/refreshed PC box.

**Practical scenario**

PC actions are asynchronous. Issue one operation, return, and wait for the next server refresh before making a dependent change.

```lua
function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    local result = withdrawPokemonFromPC(1, 1)
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/pc-storage/withdrawpokemonfrompc`</small>


## swapPokemonFromPC()

~~~ lua
function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    local result = swapPokemonFromPC(1, 1, 2)
    return
end
    return
end
~~~

**Signature**

`result = swapPokemonFromPC(boxId, boxPokemonId, teamPokemonId)`

Swap the Pokémon at the one-based team index with the Pokémon at the one-based index in the selected PC box. The tool sends the official database-ID swap packet and applies the server PC delta update, so the PC Pokémon can be at any position in the box, including the first slot.

**Practical scenario**

PC actions are asynchronous. Issue one operation, return, and wait for the next server refresh before making a dependent change.

```lua
function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    local result = swapPokemonFromPC(1, 1, 2)
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |
| `teamPokemonId` | `integer` | yes | Value passed to the `teamPokemonId` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/pc-storage/swappokemonfrompc`</small>


## swapPokemonWithinPC()

~~~ lua
function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    local result = swapPokemonWithinPC(1, 1, 2)
    return
end
    return
end
~~~

**Signature**

`result = swapPokemonWithinPC(boxId, firstBoxPokemonId, secondBoxPokemonId)`

Swap two Pokémon positions inside the same visible PC box. Both PC indexes are one-based. The server returns a position-pair delta, and the tool updates the cached PC slot order without refreshing the full box.

**Practical scenario**

PC actions are asynchronous. Issue one operation, return, and wait for the next server refresh before making a dependent change.

```lua
function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    local result = swapPokemonWithinPC(1, 1, 2)
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `firstBoxPokemonId` | `integer` | yes | Value passed to the `firstBoxPokemonId` parameter. |
| `secondBoxPokemonId` | `integer` | yes | Value passed to the `secondBoxPokemonId` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/pc-storage/swappokemonwithinpc`</small>


## releasePokemonFromPC()

~~~ lua
function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    if not isCurrentPCBoxRefreshed() then
        refreshPCBox()
        return
    end

    if getPokemonNameFromPC(1, 1) == "Rattata" then
        releasePokemonFromPC(1, 1)
        return
    end
end
~~~

**Signature**

`result = releasePokemonFromPC(boxId, boxPokemonId)`

Permanently release/delete the Pokémon at the one-based index in the selected PC box. This cannot be undone. The tool resolves the Pokémon database ID, sends the official release packet, and waits for the server PC delta remove update.

**Practical scenario**

Release only after opening the correct box and validating the target. The operation is permanent and asynchronous.

```lua
function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    if not isCurrentPCBoxRefreshed() then
        refreshPCBox()
        return
    end

    if getPokemonNameFromPC(1, 1) == "Rattata" then
        releasePokemonFromPC(1, 1)
        return
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |
| `boxPokemonId` | `integer` | yes | One-based Pokémon position inside the selected PC box. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/pc-storage/releasepokemonfrompc`</small>


## refreshPCBox()

~~~ lua
function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    local result = refreshPCBox(1)
    return
end
    return
end
~~~

**Signature**

`result = refreshPCBox(boxId)`

Request a refresh for the specified PC box. The response can be a full box snapshot, a metadata-only update, or a delta update. Use `isCurrentPCBoxRefreshed()` before reading the refreshed contents immediately after this call.

**Practical scenario**

PC actions are asynchronous. Issue one operation, return, and wait for the next server refresh before making a dependent change.

```lua
function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    function onPathAction()
    if not isPCOpen() then
        usePC()
        return
    end

    local result = refreshPCBox(1)
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `boxId` | `integer` | yes | One-based PC box number. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/pc-storage/refreshpcbox`</small>



# Battle state

## isOpponentShiny()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = isOpponentShiny()
    log("isOpponentShiny: " .. tostring(result))
    attack()
end
    log("isOpponentShiny: " .. tostring(result))
    attack()
end
~~~

**Signature**

`result = isOpponentShiny()`

Returns true if the opponent pokémon is shiny.

**Practical scenario**

Call this only from battle logic. It is a query and can be combined with one battle action in the same callback.

```lua
function onBattleAction()
    function onBattleAction()
    local result = isOpponentShiny()
    log("isOpponentShiny: " .. tostring(result))
    attack()
end
    log("isOpponentShiny: " .. tostring(result))
    attack()
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/battle-state/isopponentshiny`</small>


## isAlreadyCaught()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = isAlreadyCaught()
    log("isAlreadyCaught: " .. tostring(result))
    attack()
end
    log("isAlreadyCaught: " .. tostring(result))
    attack()
end
~~~

**Signature**

`result = isAlreadyCaught()`

Returns true if the opponent pokémon has already been caught and has a pokédex entry.

**Practical scenario**

Call this only from battle logic. It is a query and can be combined with one battle action in the same callback.

```lua
function onBattleAction()
    function onBattleAction()
    local result = isAlreadyCaught()
    log("isAlreadyCaught: " .. tostring(result))
    attack()
end
    log("isAlreadyCaught: " .. tostring(result))
    attack()
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/battle-state/isalreadycaught`</small>


## isWildBattle()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = isWildBattle()
    log("isWildBattle: " .. tostring(result))
    attack()
end
    log("isWildBattle: " .. tostring(result))
    attack()
end
~~~

**Signature**

`result = isWildBattle()`

Returns true if the current battle is against a wild pokémon.

**Practical scenario**

Call this only from battle logic. It is a query and can be combined with one battle action in the same callback.

```lua
function onBattleAction()
    function onBattleAction()
    local result = isWildBattle()
    log("isWildBattle: " .. tostring(result))
    attack()
end
    log("isWildBattle: " .. tostring(result))
    attack()
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/battle-state/iswildbattle`</small>


## getActivePokemonNumber()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = getActivePokemonNumber()
    log("getActivePokemonNumber: " .. tostring(result))
    attack()
end
    log("getActivePokemonNumber: " .. tostring(result))
    attack()
end
~~~

**Signature**

`result = getActivePokemonNumber()`

Returns the index of the active team pokémon in the current battle.

**Practical scenario**

Call this only from battle logic. It is a query and can be combined with one battle action in the same callback.

```lua
function onBattleAction()
    function onBattleAction()
    local result = getActivePokemonNumber()
    log("getActivePokemonNumber: " .. tostring(result))
    attack()
end
    log("getActivePokemonNumber: " .. tostring(result))
    attack()
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/battle-state/getactivepokemonnumber`</small>


## getOpponentId()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = getOpponentId()
    log("getOpponentId: " .. tostring(result))
    attack()
end
    log("getOpponentId: " .. tostring(result))
    attack()
end
~~~

**Signature**

`result = getOpponentId()`

Returns the id of the opponent pokémon in the current battle.

**Practical scenario**

Call this only from battle logic. It is a query and can be combined with one battle action in the same callback.

```lua
function onBattleAction()
    function onBattleAction()
    local result = getOpponentId()
    log("getOpponentId: " .. tostring(result))
    attack()
end
    log("getOpponentId: " .. tostring(result))
    attack()
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/battle-state/getopponentid`</small>


## getOpponentName()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = getOpponentName()
    log("getOpponentName: " .. tostring(result))
    attack()
end
    log("getOpponentName: " .. tostring(result))
    attack()
end
~~~

**Signature**

`result = getOpponentName()`

Returns the name of the opponent pokémon in the current battle.

**Practical scenario**

Call this only from battle logic. It is a query and can be combined with one battle action in the same callback.

```lua
function onBattleAction()
    function onBattleAction()
    local result = getOpponentName()
    log("getOpponentName: " .. tostring(result))
    attack()
end
    log("getOpponentName: " .. tostring(result))
    attack()
end
```

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/battle-state/getopponentname`</small>


## getOpponentHealth()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = getOpponentHealth()
    log("getOpponentHealth: " .. tostring(result))
    attack()
end
    log("getOpponentHealth: " .. tostring(result))
    attack()
end
~~~

**Signature**

`result = getOpponentHealth()`

Returns the current health of the opponent pokémon in the current battle.

**Practical scenario**

Call this only from battle logic. It is a query and can be combined with one battle action in the same callback.

```lua
function onBattleAction()
    function onBattleAction()
    local result = getOpponentHealth()
    log("getOpponentHealth: " .. tostring(result))
    attack()
end
    log("getOpponentHealth: " .. tostring(result))
    attack()
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/battle-state/getopponenthealth`</small>


## getOpponentMaxHealth()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = getOpponentMaxHealth()
    log("getOpponentMaxHealth: " .. tostring(result))
    attack()
end
    log("getOpponentMaxHealth: " .. tostring(result))
    attack()
end
~~~

**Signature**

`result = getOpponentMaxHealth()`

Returns the maximum health of the opponent pokémon in the current battle.

**Practical scenario**

Call this only from battle logic. It is a query and can be combined with one battle action in the same callback.

```lua
function onBattleAction()
    function onBattleAction()
    local result = getOpponentMaxHealth()
    log("getOpponentMaxHealth: " .. tostring(result))
    attack()
end
    log("getOpponentMaxHealth: " .. tostring(result))
    attack()
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/battle-state/getopponentmaxhealth`</small>


## getOpponentHealthPercent()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = getOpponentHealthPercent()
    log("getOpponentHealthPercent: " .. tostring(result))
    attack()
end
    log("getOpponentHealthPercent: " .. tostring(result))
    attack()
end
~~~

**Signature**

`result = getOpponentHealthPercent()`

Returns the percentage of remaining health of the opponent pokémon in the current battle.

**Practical scenario**

Call this only from battle logic. It is a query and can be combined with one battle action in the same callback.

```lua
function onBattleAction()
    function onBattleAction()
    local result = getOpponentHealthPercent()
    log("getOpponentHealthPercent: " .. tostring(result))
    attack()
end
    log("getOpponentHealthPercent: " .. tostring(result))
    attack()
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/battle-state/getopponenthealthpercent`</small>


## getOpponentLevel()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = getOpponentLevel()
    log("getOpponentLevel: " .. tostring(result))
    attack()
end
    log("getOpponentLevel: " .. tostring(result))
    attack()
end
~~~

**Signature**

`result = getOpponentLevel()`

Returns the level of the opponent pokémon in the current battle.

**Practical scenario**

Call this only from battle logic. It is a query and can be combined with one battle action in the same callback.

```lua
function onBattleAction()
    function onBattleAction()
    local result = getOpponentLevel()
    log("getOpponentLevel: " .. tostring(result))
    attack()
end
    log("getOpponentLevel: " .. tostring(result))
    attack()
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/battle-state/getopponentlevel`</small>


## getOpponentStatus()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = getOpponentStatus()
    log("getOpponentStatus: " .. tostring(result))
    attack()
end
    log("getOpponentStatus: " .. tostring(result))
    attack()
end
~~~

**Signature**

`result = getOpponentStatus()`

Returns the status of the opponent pokémon in the current battle.

**Practical scenario**

Call this only from battle logic. It is a query and can be combined with one battle action in the same callback.

```lua
function onBattleAction()
    function onBattleAction()
    local result = getOpponentStatus()
    log("getOpponentStatus: " .. tostring(result))
    attack()
end
    log("getOpponentStatus: " .. tostring(result))
    attack()
end
```

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/battle-state/getopponentstatus`</small>


## getOpponentForm()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = getOpponentForm()
    log("getOpponentForm: " .. tostring(result))
    attack()
end
    log("getOpponentForm: " .. tostring(result))
    attack()
end
~~~

**Signature**

`result = getOpponentForm()`

Returns the form of the opponent pokémon in the current battle (0 if no form).

**Practical scenario**

Call this only from battle logic. It is a query and can be combined with one battle action in the same callback.

```lua
function onBattleAction()
    function onBattleAction()
    local result = getOpponentForm()
    log("getOpponentForm: " .. tostring(result))
    attack()
end
    log("getOpponentForm: " .. tostring(result))
    attack()
end
```

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/battle-state/getopponentform`</small>


## getOpponentGender()

~~~ lua
function onBattleAction()
    local gender = getOpponentGender()

    if gender == "M" then
        log("Male opponent detected.")
    elseif gender == "F" then
        log("Female opponent detected.")
    else
        log("Genderless or unknown opponent.")
    end

    attack()
end
~~~

**Signature**

`result = getOpponentGender()`

Returns the gender of the current opponent Pokémon. The result is `"M"` for male, `"F"` for female, or an empty string for genderless/unknown. This function is valid only during battle; calling it outside battle triggers the same fatal Lua error contract as the other `getOpponent...` helpers.

**Practical scenario**

Use this during battle when behavior depends on gender-specific moves, abilities, or encounter rules.

```lua
function onBattleAction()
    local gender = getOpponentGender()

    if gender == "M" then
        log("Male opponent detected.")
    elseif gender == "F" then
        log("Female opponent detected.")
    else
        log("Genderless or unknown opponent.")
    end

    attack()
end
```

### Returns

`string` — example: `"M"`

<small>Source key: `POST /lua/battle-state/getopponentgender`</small>



## getBattleTurn()

~~~ lua
function onBattleAction()
    local turn = getBattleTurn()

    if turn == 1 then
        log("First server-confirmed battle turn.")
        useMove("Thunder Wave")
        return
    end

    log("Current battle turn: " .. tostring(turn))
    attack()
end
~~~

**Signature**

`result = getBattleTurn()`

Returns the latest battle turn number confirmed by the server through the `BT:n` battle marker. The value is monotonic for the current battle: duplicate or out-of-order lower markers do not move the turn backwards. `0` means the battle exists but no valid `BT:n` marker has been received yet.

This function is valid only during battle. Calling it outside battle follows the tool's fatal Lua error contract.

**Practical scenario**

Use the server-backed turn number when a script needs different behavior on the first turn or after several turns. Unlike counting `onBattleAction()` calls, this remains aligned with server battle progression when a move continues automatically, a forced switch occurs, or one player command spans multiple server turns.

```lua
function onBattleAction()
    local turn = getBattleTurn()

    if turn == 1 then
        log("First server-confirmed battle turn.")
        useMove("Thunder Wave")
        return
    end

    log("Current battle turn: " .. tostring(turn))
    attack()
end
```

### Returns

`integer` — `0` before the first valid `BT:n` marker, otherwise the latest server-confirmed turn number such as `1`, `2`, `4`, ...

<small>Source key: `POST /lua/battle-state/getbattleturn`</small>


## isOpponentEffortValue()

~~~ lua
function onBattleAction()
    if isOpponentEffortValue("ATK") then
        attack()
    else
        run()
    end
end
~~~

**Signature**

`result = isOpponentEffortValue(statType)`

Returns true if the opponent is only giving the specified effort value.

**Practical scenario**

Use a documented stat key to verify that the opponent gives only the EV you are training.

```lua
function onBattleAction()
    if isOpponentEffortValue("ATK") then
        attack()
    else
        run()
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `statType` | `string` | yes | Stat name such as `HP`, `ATK`, `DEF`, `SPA`, `SPD`, or `SPE`. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/battle-state/isopponenteffortvalue`</small>


## getOpponentEffortValue()

~~~ lua
function onBattleAction()
    local attackYield = getOpponentEffortValue("ATK")
    log("Opponent Attack EV yield: " .. tostring(attackYield))
    attack()
end
~~~

**Signature**

`result = getOpponentEffortValue(statType)`

Returns the amount of a particular EV given by the opponent.

**Practical scenario**

Read the exact EV yield of the current opponent for one stat.

```lua
function onBattleAction()
    local attackYield = getOpponentEffortValue("ATK")
    log("Opponent Attack EV yield: " .. tostring(attackYield))
    attack()
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `statType` | `string` | yes | Stat name such as `HP`, `ATK`, `DEF`, `SPA`, `SPD`, or `SPE`. |

### Returns

`integer` — example: `1`

<small>Source key: `POST /lua/battle-state/getopponenteffortvalue`</small>


## getOpponentType()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = getOpponentType()
    log("getOpponentType: " .. tostring(result))
    attack()
end
    log("getOpponentType: " .. tostring(result))
    attack()
end
~~~

**Signature**

`result = getOpponentType()`

Returns the type of the opponent pokémon in the current battle as an array of length 2.

**Practical scenario**

Call this only from battle logic. It is a query and can be combined with one battle action in the same callback.

```lua
function onBattleAction()
    function onBattleAction()
    local result = getOpponentType()
    log("getOpponentType: " .. tostring(result))
    attack()
end
    log("getOpponentType: " .. tostring(result))
    attack()
end
```

### Returns

`array<string>` — example: `[]`

<small>Source key: `POST /lua/battle-state/getopponenttype`</small>



# Path actions

## moveToCell()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = moveToCell(10, 15)
    return
end
    return
end
~~~

**Signature**

`result = moveToCell(x, y)`

Moves to the specified coordinates.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = moveToCell(10, 15)
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `x` | `integer` | yes | Map X coordinate. |
| `y` | `integer` | yes | Map Y coordinate. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/movetocell`</small>


## moveToListCell()

~~~ lua
function onPathAction()
    local preferred = "10-15,11-15,12-15"
    local alternate = "10-16,11-16,12-16"
    moveToListCell(preferred, alternate)
    return
end
~~~

**Signature**

`result = moveToListCell(list, "")`

Moves to the specified list coordinates.

**Practical scenario**

Provide comma-separated `x-y` cell lists. The optional second list can represent cells to avoid or an alternate set used by the path helper.

```lua
function onPathAction()
    local preferred = "10-15,11-15,12-15"
    local alternate = "10-16,11-16,12-16"
    moveToListCell(preferred, alternate)
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `list` | `string` | yes | Value passed to the `list` parameter. |
| `""` | `string` | yes | Value passed to the `""` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/movetolistcell`</small>


## moveToMap()

~~~ lua
function onPathAction()
    -- moveToMap("Viridian City") is retired.
    -- Walk onto the known map-link cell instead.
    moveToCell(25, 42)
    return
end
~~~

**Signature**

`result = moveToMap(mapName)`

Moves to the nearest cell teleporting to the specified map.

**Practical scenario**

This legacy function is retired. Walk to the destination map link with `moveToCell()` instead.

```lua
function onPathAction()
    -- moveToMap("Viridian City") is retired.
    -- Walk onto the known map-link cell instead.
    moveToCell(25, 42)
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `mapName` | `string` | yes | Value passed to the `mapName` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/movetomap`</small>


## moveToRectangle()

~~~ lua
function onPathAction()
    moveToRectangle(10, 15, 14, 19)
    return
end
~~~

**Signature**

`result = moveToRectangle(...)`

Moves to a random accessible cell of the specified rectangle.

**Practical scenario**

Pass four coordinates: minimum X/Y followed by maximum X/Y. The tool chooses a random accessible cell inside the rectangle.

```lua
function onPathAction()
    moveToRectangle(10, 15, 14, 19)
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `arg1` | `array<LuaValue>` | yes | Value passed to the `arg1` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/movetorectangle`</small>


## moveToNormalGround()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = moveToNormalGround()
    return
end
    return
end
~~~

**Signature**

`result = moveToNormalGround()`

Move randomly avoiding water and links.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = moveToNormalGround()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/movetonormalground`</small>


## moveToGrass()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = moveToGrass()
    return
end
    return
end
~~~

**Signature**

`result = moveToGrass()`

Moves to the nearest grass patch then move randomly inside it.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = moveToGrass()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/movetograss`</small>


## moveToWater()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = moveToWater()
    return
end
    return
end
~~~

**Signature**

`result = moveToWater()`

Moves to the nearest water area then move randomly inside it.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = moveToWater()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/movetowater`</small>


## moveNearExit()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = moveNearExit("Viridian City")
    return
end
    return
end
~~~

**Signature**

`result = moveNearExit(mapName)`

Moves near the cell teleporting to the specified map.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = moveNearExit("Viridian City")
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `mapName` | `string` | yes | Value passed to the `mapName` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/movenearexit`</small>


## talkToNpc()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = talkToNpc("Nurse Joy")
    return
end
    return
end
~~~

**Signature**

`result = talkToNpc(npcName)`

Moves then talk to NPC specified by its name.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = talkToNpc("Nurse Joy")
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `npcName` | `string` | yes | Exact or documented NPC name. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/talktonpc`</small>


## talkToNpcOnCell()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = talkToNpcOnCell(10, 15)
    return
end
    return
end
~~~

**Signature**

`result = talkToNpcOnCell(cellX, cellY)`

Moves then talk to NPC located on the specified cell.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = talkToNpcOnCell(10, 15)
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `cellX` | `integer` | yes | Value passed to the `cellX` parameter. |
| `cellY` | `integer` | yes | Value passed to the `cellY` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/talktonpconcell`</small>


## usePokecenter()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = usePokecenter()
    return
end
    return
end
~~~

**Signature**

`result = usePokecenter()`

Moves to the Nurse Joy then talk to the cell below her.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = usePokecenter()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/usepokecenter`</small>


## swapPokemon()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = swapPokemon(1, 1)
    return
end
    return
end
~~~

**Signature**

`result = swapPokemon(index1, index2)`

Swaps the two pokémon specified by their position in the team.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = swapPokemon(1, 1)
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index1` | `integer` | yes | Value passed to the `index1` parameter. |
| `index2` | `integer` | yes | Value passed to the `index2` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/swappokemon`</small>


## swapPokemonWithLeader()

~~~ lua
function onPathAction()
    if getPokemonName(1) ~= "Pikachu" then
        swapPokemonWithLeader("Pikachu")
        return
    end

    moveToGrass()
end
~~~

**Signature**

`result = swapPokemonWithLeader(pokemonName)`

Swaps the first pokémon with the specified name with the leader of the team.

**Practical scenario**

Move the named Pokémon to the lead slot before continuing the route.

```lua
function onPathAction()
    if getPokemonName(1) ~= "Pikachu" then
        swapPokemonWithLeader("Pikachu")
        return
    end

    moveToGrass()
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `pokemonName` | `string` | yes | Value passed to the `pokemonName` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/swappokemonwithleader`</small>


## sortTeamByLevelAscending()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = sortTeamByLevelAscending()
    return
end
    return
end
~~~

**Signature**

`result = sortTeamByLevelAscending()`

Sorts the pokémon in the team by level in ascending order, one pokémon at a time.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = sortTeamByLevelAscending()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/sortteambylevelascending`</small>


## sortTeamByLevelDescending()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = sortTeamByLevelDescending()
    return
end
    return
end
~~~

**Signature**

`result = sortTeamByLevelDescending()`

Sorts the pokémon in the team by level in descending order, one pokémon at a time.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = sortTeamByLevelDescending()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/sortteambyleveldescending`</small>


## sortTeamRangeByLevelAscending()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = sortTeamRangeByLevelAscending(10, 10)
    return
end
    return
end
~~~

**Signature**

`result = sortTeamRangeByLevelAscending(fromIndex, toIndex)`

Sorts the specified part of the team by level in ascending order, one pokémon at a time.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = sortTeamRangeByLevelAscending(10, 10)
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `fromIndex` | `integer` | yes | Value passed to the `fromIndex` parameter. |
| `toIndex` | `integer` | yes | Value passed to the `toIndex` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/sortteamrangebylevelascending`</small>


## sortTeamRangeByLevelDescending()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = sortTeamRangeByLevelDescending(10, 10)
    return
end
    return
end
~~~

**Signature**

`result = sortTeamRangeByLevelDescending(fromIndex, toIndex)`

Sorts the specified part of the team by level in descending order, one pokémon at a time.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = sortTeamRangeByLevelDescending(10, 10)
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `fromIndex` | `integer` | yes | Value passed to the `fromIndex` parameter. |
| `toIndex` | `integer` | yes | Value passed to the `toIndex` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/sortteamrangebyleveldescending`</small>


## relearnMove()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = relearnMove("Tackle")
    return
end
    return
end
~~~

**Signature**

`result = relearnMove(moveName)`

Relearn a move from the move relearner NPC.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = relearnMove("Tackle")
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `moveName` | `string` | yes | Exact move name as shown by the game. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/relearnmove`</small>


## releasePokemonFromTeam()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = releasePokemonFromTeam(1)
    return
end
    return
end
~~~

**Signature**

`result = releasePokemonFromTeam(pokemonUid)`

Releases the specified pokemon in the team.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = releasePokemonFromTeam(1)
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `pokemonUid` | `integer` | yes | Stable Pokémon database/unique identifier returned by the corresponding query API. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/releasepokemonfromteam`</small>


## enablePrivateMessage()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = enablePrivateMessage()
    return
end
    return
end
~~~

**Signature**

`result = enablePrivateMessage()`

Enable private messages from users.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = enablePrivateMessage()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/enableprivatemessage`</small>


## disablePrivateMessage()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = disablePrivateMessage()
    return
end
    return
end
~~~

**Signature**

`result = disablePrivateMessage()`

Disable private messages from users.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = disablePrivateMessage()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/disableprivatemessage`</small>


## enablePartyInspection()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = enablePartyInspection()
    return
end
    return
end
~~~

**Signature**

`result = enablePartyInspection()`

Enable party inspection from users.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = enablePartyInspection()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/enablepartyinspection`</small>


## disablePartyInspection()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = disablePartyInspection()
    return
end
    return
end
~~~

**Signature**

`result = disablePartyInspection()`

Disable party inspection from users.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = disablePartyInspection()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/disablepartyinspection`</small>


## enableAutoEvolve()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = enableAutoEvolve()
    return
end
    return
end
~~~

**Signature**

`result = enableAutoEvolve()`

Enable auto evolve on Pkm Catchem client.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = enableAutoEvolve()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/enableautoevolve`</small>


## disableAutoEvolve()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = disableAutoEvolve()
    return
end
    return
end
~~~

**Signature**

`result = disableAutoEvolve()`

Disable auto evolve on Pkm Catchem client.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = disableAutoEvolve()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/disableautoevolve`</small>


## enableNpcInteractions()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = enableNpcInteractions()
    return
end
    return
end
~~~

**Signature**

`result = enableNpcInteractions()`

Enables npc interactions.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = enableNpcInteractions()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/enablenpcinteractions`</small>


## disableNpcInteractions()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = disableNpcInteractions()
    return
end
    return
end
~~~

**Signature**

`result = disableNpcInteractions()`

Disables npc interactions.

**Practical scenario**

Use this in `onPathAction()` and return immediately so only one overworld action is issued in the frame.

```lua
function onPathAction()
    function onPathAction()
    local result = disableNpcInteractions()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/path-actions/disablenpcinteractions`</small>



# Dialog functions

## pushDialogAnswer()

~~~ lua
function onPathAction()
    pushDialogAnswer("Yes")
    talkToNpc("Nurse Joy")
end
~~~

**Signature**

`pushDialogAnswer(answerValue)`

Adds the specified answer to the answer queue. It will be used in the next dialog.

**Practical scenario**

Queue the expected answer before interacting with the NPC that will open the dialog.

```lua
function onPathAction()
    pushDialogAnswer("Yes")
    talkToNpc("Nurse Joy")
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `answerValue` | `LuaValue` | yes | Any Lua value. |

### Returns

`void`

<small>Source key: `POST /lua/dialog-functions/pushdialoganswer`</small>



# Battle actions

## attack()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = attack()
    return
end
    return
end
~~~

**Signature**

`result = attack()`

Uses the most effective offensive move available.

**Practical scenario**

Choose this action in `onBattleAction()` and return immediately so only one battle action is sent in the frame.

```lua
function onBattleAction()
    function onBattleAction()
    local result = attack()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/battle-actions/attack`</small>


## weakAttack()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = weakAttack()
    return
end
    return
end
~~~

**Signature**

`result = weakAttack()`

Uses the least effective offensive move available.

**Practical scenario**

Choose this action in `onBattleAction()` and return immediately so only one battle action is sent in the frame.

```lua
function onBattleAction()
    function onBattleAction()
    local result = weakAttack()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/battle-actions/weakattack`</small>


## run()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = run()
    return
end
    return
end
~~~

**Signature**

`result = run()`

Tries to escape from the current wild battle.

**Practical scenario**

Choose this action in `onBattleAction()` and return immediately so only one battle action is sent in the frame.

```lua
function onBattleAction()
    function onBattleAction()
    local result = run()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/battle-actions/run`</small>


## sendUsablePokemon()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = sendUsablePokemon()
    return
end
    return
end
~~~

**Signature**

`result = sendUsablePokemon()`

Sends the first usable pokemon different from the active one.

**Practical scenario**

Choose this action in `onBattleAction()` and return immediately so only one battle action is sent in the frame.

```lua
function onBattleAction()
    function onBattleAction()
    local result = sendUsablePokemon()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/battle-actions/sendusablepokemon`</small>


## sendAnyPokemon()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = sendAnyPokemon()
    return
end
    return
end
~~~

**Signature**

`result = sendAnyPokemon()`

Sends the first available pokemon different from the active one.

**Practical scenario**

Choose this action in `onBattleAction()` and return immediately so only one battle action is sent in the frame.

```lua
function onBattleAction()
    function onBattleAction()
    local result = sendAnyPokemon()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/battle-actions/sendanypokemon`</small>


## sendPokemon()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = sendPokemon(1)
    return
end
    return
end
~~~

**Signature**

`result = sendPokemon(index)`

Sends the specified pokemon to battle.

**Practical scenario**

Choose this action in `onBattleAction()` and return immediately so only one battle action is sent in the frame.

```lua
function onBattleAction()
    function onBattleAction()
    local result = sendPokemon(1)
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/battle-actions/sendpokemon`</small>


## useMove()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = useMove("Tackle")
    return
end
    return
end
~~~

**Signature**

`result = useMove(moveName)`

Uses the specified move in the current battle if available.

**Practical scenario**

Choose this action in `onBattleAction()` and return immediately so only one battle action is sent in the frame.

```lua
function onBattleAction()
    function onBattleAction()
    local result = useMove("Tackle")
    return
end
    return
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `moveName` | `string` | yes | Exact move name as shown by the game. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/battle-actions/usemove`</small>


## useAnyMove()

~~~ lua
function onBattleAction()
    function onBattleAction()
    local result = useAnyMove()
    return
end
    return
end
~~~

**Signature**

`result = useAnyMove()`

Uses the first available move or struggle if out of PP.

**Practical scenario**

Choose this action in `onBattleAction()` and return immediately so only one battle action is sent in the frame.

```lua
function onBattleAction()
    function onBattleAction()
    local result = useAnyMove()
    return
end
    return
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/battle-actions/useanymove`</small>



# Bot configuration

## setAfk()

~~~ lua
function onStart()
    function onStart()
    local result = setAfk(1)
end
end
~~~

**Signature**

`result = setAfk(value)`

Sets afk timeout for BOT

**Practical scenario**

Set this during startup or when changing modes, rather than writing it every frame.

```lua
function onStart()
    function onStart()
    local result = setAfk(1)
end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `value` | `integer` | yes | Value to store or send. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/bot-configuration/setafk`</small>


## setAfkTimeout()

~~~ lua
function onStart()
    function onStart()
    local result = setAfkTimeout(1)
end
end
~~~

**Signature**

`result = setAfkTimeout(value)`

Sets afk timeout for BOT

**Practical scenario**

Set this during startup or when changing modes, rather than writing it every frame.

```lua
function onStart()
    function onStart()
    local result = setAfkTimeout(1)
end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `value` | `integer` | yes | Value to store or send. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/bot-configuration/setafktimeout`</small>



# Move learning actions

## forgetMove()

~~~ lua
function onLearningMove(moveName, pokemonIndex)
    function onLearningMove(moveName, pokemonIndex)
    local result = forgetMove("Tackle")
end
end
~~~

**Signature**

`result = forgetMove(moveName)`

Forgets the specified move, if existing, in order to learn a new one.

**Practical scenario**

Call this from `onLearningMove()` and choose exactly one move-learning action.

```lua
function onLearningMove(moveName, pokemonIndex)
    function onLearningMove(moveName, pokemonIndex)
    local result = forgetMove("Tackle")
end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `moveName` | `string` | yes | Exact move name as shown by the game. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/move-learning-actions/forgetmove`</small>


## forgetAnyMoveExcept()

~~~ lua
function onLearningMove(moveName, pokemonIndex)
    forgetAnyMoveExcept("Thunderbolt", "Volt Tackle")
end
~~~

**Signature**

`result = forgetAnyMoveExcept(...)`

Forgets the first move that is not one of the specified moves.

**Practical scenario**

Pass move names that must be preserved. The tool forgets the first current move not in that list.

```lua
function onLearningMove(moveName, pokemonIndex)
    forgetAnyMoveExcept("Thunderbolt", "Volt Tackle")
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `moveNames` | `array<LuaValue>` | yes | Value passed to the `moveNames` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/move-learning-actions/forgetanymoveexcept`</small>



# Custom options

## setOption()

~~~ lua
function onStart()
    function onStart()
    setOption(1, true)
end
end
~~~

**Signature**

`setOption(index, value)`

Sets the option at a particular index, or creates it if it doesn't exist

**Practical scenario**

Define or update script options during startup so the user can configure behavior from the UI.

```lua
function onStart()
    function onStart()
    setOption(1, true)
end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |
| `value` | `boolean` | yes | Value to store or send. |

### Returns

`void`

<small>Source key: `POST /lua/custom-options/setoption`</small>


## getOption()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getOption(1)
    log("getOption: " .. tostring(result))
end
    log("getOption: " .. tostring(result))
end
~~~

**Signature**

`result = getOption(index)`

Gets the option at a particular index, or creates it if it doesn't exist

**Practical scenario**

Read the user-selected option when deciding what action the script should take.

```lua
function onPathAction()
    function onPathAction()
    local result = getOption(1)
    log("getOption: " .. tostring(result))
end
    log("getOption: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/custom-options/getoption`</small>


## setOptionName()

~~~ lua
function onStart()
    setOption(1, true)
    setOptionName(1, "Catch uncaught Pokémon")
end
~~~

**Signature**

`setOptionName(index, content)`

Sets the name of the option at a particular index, or creates it if it doesn't exist

**Practical scenario**

Give a boolean option a user-facing label during script startup.

```lua
function onStart()
    setOption(1, true)
    setOptionName(1, "Catch uncaught Pokémon")
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |
| `content` | `string` | yes | Value passed to the `content` parameter. |

### Returns

`void`

<small>Source key: `POST /lua/custom-options/setoptionname`</small>


## setOptionDescription()

~~~ lua
function onStart()
    setOptionDescription(1, "When enabled, the script weakens and catches species not yet owned.")
end
~~~

**Signature**

`setOptionDescription(index, content)`

Sets the tooltip description of the option at a particular index, or creates it if it doesn't exist

**Practical scenario**

Explain exactly what a boolean option changes so the user can configure the script safely.

```lua
function onStart()
    setOptionDescription(1, "When enabled, the script weakens and catches species not yet owned.")
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |
| `content` | `string` | yes | Value passed to the `content` parameter. |

### Returns

`void`

<small>Source key: `POST /lua/custom-options/setoptiondescription`</small>


## removeOption()

~~~ lua
function onStart()
    function onStart()
    removeOption(1)
end
end
~~~

**Signature**

`removeOption(index)`

Removes the slider option at the specified index

**Practical scenario**

Define or update script options during startup so the user can configure behavior from the UI.

```lua
function onStart()
    function onStart()
    removeOption(1)
end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`void`

<small>Source key: `POST /lua/custom-options/removeoption`</small>


## setTextOption()

~~~ lua
function onStart()
    setTextOption(1, "Pikachu")
    setTextOptionName(1, "Target Pokémon")
end
~~~

**Signature**

`setTextOption(index, content)`

Sets the text of the TextOption at a particular index, or creates it if it doesn't exist

**Practical scenario**

Create a text option with a meaningful default value.

```lua
function onStart()
    setTextOption(1, "Pikachu")
    setTextOptionName(1, "Target Pokémon")
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |
| `content` | `string` | yes | Value passed to the `content` parameter. |

### Returns

`void`

<small>Source key: `POST /lua/custom-options/settextoption`</small>


## getTextOption()

~~~ lua
function onPathAction()
    function onPathAction()
    local result = getTextOption(1)
    log("getTextOption: " .. tostring(result))
end
    log("getTextOption: " .. tostring(result))
end
~~~

**Signature**

`result = getTextOption(index)`

Returns the text content of the TextOption at a particular index, or an empty string if it doesn't exist

**Practical scenario**

Read the user-selected option when deciding what action the script should take.

```lua
function onPathAction()
    function onPathAction()
    local result = getTextOption(1)
    log("getTextOption: " .. tostring(result))
end
    log("getTextOption: " .. tostring(result))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`string` — example: `"value"`

<small>Source key: `POST /lua/custom-options/gettextoption`</small>


## setTextOptionName()

~~~ lua
function onStart()
    setTextOptionName(1, "Target Pokémon")
end
~~~

**Signature**

`setTextOptionName(index, content)`

Sets the name of the TextOption at a particular index, or creates it if it doesn't exist

**Practical scenario**

Give a text option a concise user-facing label.

```lua
function onStart()
    setTextOptionName(1, "Target Pokémon")
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |
| `content` | `string` | yes | Value passed to the `content` parameter. |

### Returns

`void`

<small>Source key: `POST /lua/custom-options/settextoptionname`</small>


## setTextOptionDescription()

~~~ lua
function onStart()
    setTextOptionDescription(1, "Exact species name, for example Pikachu or Eevee.")
end
~~~

**Signature**

`setTextOptionDescription(index, content)`

Sets the tooltip description of the TextOption at a particular index, or creates it if it doesn't exist

**Practical scenario**

Describe the accepted text format and provide an example.

```lua
function onStart()
    setTextOptionDescription(1, "Exact species name, for example Pikachu or Eevee.")
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |
| `content` | `string` | yes | Value passed to the `content` parameter. |

### Returns

`void`

<small>Source key: `POST /lua/custom-options/settextoptiondescription`</small>


## removeTextOption()

~~~ lua
function onStart()
    function onStart()
    removeTextOption(1)
end
end
~~~

**Signature**

`removeTextOption(index)`

Removes the text option at the specified index

**Practical scenario**

Define or update script options during startup so the user can configure behavior from the UI.

```lua
function onStart()
    function onStart()
    removeTextOption(1)
end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `index` | `integer` | yes | One-based index in the current team or option list, depending on the API. |

### Returns

`void`

<small>Source key: `POST /lua/custom-options/removetextoption`</small>



# File APIs

## writeToFile()

~~~ lua
function onStop()
    writeToFile("state/last-map.txt", getMapName(), true)
end
~~~

**Signature**

`writeToFile(filename, text, false)`

Writes a string to file overwrite is an optional parameter, and will append the line(s) if absent

**Practical scenario**

Persist a small state snapshot. Set the third argument to `true` to overwrite or `false` to append.

```lua
function onStop()
    writeToFile("state/last-map.txt", getMapName(), true)
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `filename` | `string` | yes | Value passed to the `filename` parameter. |
| `text` | `string` | yes | Value passed to the `text` parameter. |
| `false` | `boolean` | yes | Value passed to the `false` parameter. |

### Returns

`void`

<small>Source key: `POST /lua/file-apis/writetofile`</small>


## logToFile()

~~~ lua
function onWarningMessage(differentMap, distance)
    logToFile("logs/warnings.txt", {
        map = getMapName(),
        differentMap = differentMap,
        distance = distance
    }, false)
end
~~~

**Signature**

`logToFile(file, text, false)`

Writes a string, a number, or a table of strings and/or numbers to file overwrite is an optional parameter, and will append the line(s) if absent

**Practical scenario**

Append structured diagnostic values without relying only on the visible message log.

```lua
function onWarningMessage(differentMap, distance)
    logToFile("logs/warnings.txt", {
        map = getMapName(),
        differentMap = differentMap,
        distance = distance
    }, false)
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `file` | `string` | yes | Path relative to the script/tool data directory. |
| `text` | `LuaValue` | yes | Any Lua value. |
| `false` | `boolean` | yes | Value passed to the `false` parameter. |

### Returns

`void`

<small>Source key: `POST /lua/file-apis/logtofile`</small>


## readLinesFromFile()

~~~ lua
function onStart()
    function onStart()
    local result = readLinesFromFile("logs/script.txt")
    if result ~= nil then
        log("File API completed.")
    end
end
    if result ~= nil then
        log("File API completed.")
    end
end
~~~

**Signature**

`result = readLinesFromFile(file)`

Returns a table of every line in file

**Practical scenario**

Use script-local files for small persistent state or diagnostics. Handle missing/empty data before indexing returned lines.

```lua
function onStart()
    function onStart()
    local result = readLinesFromFile("logs/script.txt")
    if result ~= nil then
        log("File API completed.")
    end
end
    if result ~= nil then
        log("File API completed.")
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `file` | `string` | yes | Path relative to the script/tool data directory. |

### Returns

`array<string>` — example: `[]`

<small>Source key: `POST /lua/file-apis/readlinesfromfile`</small>


## tradeGiveMoney()

~~~ lua
function prepareTrade()
    local ok = tradeGiveMoney("TrustedPlayer", 15000)
    log("Money offer prepared: " .. tostring(ok))
end
~~~

**Signature**

`result = tradeGiveMoney(username, money)`

Used to trade money With Parameters Username and Money

**Practical scenario**

Use only inside the intended trade flow and validate the recipient and amount.

```lua
function prepareTrade()
    local ok = tradeGiveMoney("TrustedPlayer", 15000)
    log("Money offer prepared: " .. tostring(ok))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `username` | `string` | yes | Value passed to the `username` parameter. |
| `money` | `integer` | yes | Value passed to the `money` parameter. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/file-apis/tradegivemoney`</small>


## tradeAcceptMoney()

~~~ lua
function onStart()
    function onStart()
    local result = tradeAcceptMoney()
    if result ~= nil then
        log("File API completed.")
    end
end
    if result ~= nil then
        log("File API completed.")
    end
end
~~~

**Signature**

`result = tradeAcceptMoney()`

Lua function `tradeAcceptMoney`.

**Practical scenario**

Use script-local files for small persistent state or diagnostics. Handle missing/empty data before indexing returned lines.

```lua
function onStart()
    function onStart()
    local result = tradeAcceptMoney()
    if result ~= nil then
        log("File API completed.")
    end
end
    if result ~= nil then
        log("File API completed.")
    end
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/file-apis/tradeacceptmoney`</small>



# Chat

## closeChannel()

~~~ lua
function onStart()
    local closed = closeChannel("Trade")
    log("Trade channel closed: " .. tostring(closed))
end
~~~

**Signature**

`result = closeChannel(name)`

Close channel chat by name

**Practical scenario**

Close a channel by its visible name when the script no longer needs it.

```lua
function onStart()
    local closed = closeChannel("Trade")
    log("Trade channel closed: " .. tostring(closed))
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `name` | `string` | yes | Name of the option, hook, variable, or resource. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/chat/closechannel`</small>



# Notifications

## sendNotification()

~~~ lua
function onSystemMessage(message)
    if stringContains(message, "Caught") then
        function onSystemMessage(message)
    if stringContains(message, "Caught") then
        local ok = sendNotification("Shiny found")
    end
end
    end
end
~~~

**Signature**

`result = sendNotification(templateName)`

Send a configured notification template by name or id. Built-in variables such as `{player}`, `{map}`, `{x}`, `{y}`, `{account}`, `{server}`, `{bot}`, `{time}`, `{date}`, and `{datetime}` are filled automatically when available. The template's configured target controls whether it goes to personal Discord, the built-in PROCatchem Discord channel, Telegram, or all enabled channels. Returns `false` only when notifications are disabled or the template cannot be found; network delivery is asynchronous.

**Practical scenario**

Send notifications only for meaningful events to avoid duplicate alerts from callbacks that run repeatedly.

```lua
function onSystemMessage(message)
    if stringContains(message, "Caught") then
        function onSystemMessage(message)
    if stringContains(message, "Caught") then
        local ok = sendNotification("Shiny found")
    end
end
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `templateName` | `string` | yes | Template display name or stable template id. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/notifications/sendnotification`</small>


## sendNotificationWith()

~~~ lua
function onSystemMessage(message)
    if stringContains(message, "Caught") then
        function onSystemMessage(message)
    if stringContains(message, "Caught") then
        local ok = sendNotificationWith("Shiny found", { pokemon = "Gyarados", level = "30" })
    end
end
    end
end
~~~

**Signature**

`result = sendNotificationWith(templateName, values)`

Send a configured notification template and override/add template variables using a Lua table. Table keys should match template variables without braces. Per-call values override built-ins, runtime variables set by `setNotifyVar`, global variables, and template defaults.

**Practical scenario**

Send notifications only for meaningful events to avoid duplicate alerts from callbacks that run repeatedly.

```lua
function onSystemMessage(message)
    if stringContains(message, "Caught") then
        function onSystemMessage(message)
    if stringContains(message, "Caught") then
        local ok = sendNotificationWith("Shiny found", { pokemon = "Gyarados", level = "30" })
    end
end
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `templateName` | `string` | yes | Template display name or stable template id. |
| `values` | `NotificationVariables` | yes | Lua table containing template variables. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/notifications/sendnotificationwith`</small>


## sendNotificationTo()

~~~ lua
function onSystemMessage(message)
    if stringContains(message, "Caught") then
        function onSystemMessage(message)
    if stringContains(message, "Caught") then
        local ok = sendNotificationTo("Bot stopped", "personal")
    end
end
    end
end
~~~

**Signature**

`result = sendNotificationTo(templateName, target)`

Send a configured notification template while overriding its delivery target for this one call. Accepted targets are `personal`, `discord`, `procatchem`, `telegram`, and `all`. `all` falls back to the template's configured target, which defaults to all enabled channels.

**Practical scenario**

Send notifications only for meaningful events to avoid duplicate alerts from callbacks that run repeatedly.

```lua
function onSystemMessage(message)
    if stringContains(message, "Caught") then
        function onSystemMessage(message)
    if stringContains(message, "Caught") then
        local ok = sendNotificationTo("Bot stopped", "personal")
    end
end
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `templateName` | `string` | yes | Template display name or stable template id. |
| `target` | `NotificationTarget` | yes | Notification delivery target. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/notifications/sendnotificationto`</small>


## sendNotificationWithTo()

~~~ lua
function onSystemMessage(message)
    if stringContains(message, "Caught") then
        function onSystemMessage(message)
    if stringContains(message, "Caught") then
        local ok = sendNotificationWithTo("Shiny found", { pokemon = "Gyarados", level = "30" }, "procatchem")
    end
end
    end
end
~~~

**Signature**

`result = sendNotificationWithTo(templateName, values, target)`

Send a configured notification template, pass template variables, and override the delivery target for this one call. This is the most explicit notification helper for scripts that need to route different alerts to different channels.

**Practical scenario**

Send notifications only for meaningful events to avoid duplicate alerts from callbacks that run repeatedly.

```lua
function onSystemMessage(message)
    if stringContains(message, "Caught") then
        function onSystemMessage(message)
    if stringContains(message, "Caught") then
        local ok = sendNotificationWithTo("Shiny found", { pokemon = "Gyarados", level = "30" }, "procatchem")
    end
end
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `templateName` | `string` | yes | Template display name or stable template id. |
| `values` | `NotificationVariables` | yes | Lua table containing template variables. |
| `target` | `NotificationTarget` | yes | Notification delivery target. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/notifications/sendnotificationwithto`</small>


## notify()

~~~ lua
function onSystemMessage(message)
    if stringContains(message, "Caught") then
        function onSystemMessage(message)
    if stringContains(message, "Caught") then
        local ok = notify("PROCatchem: script reached Cerulean City.")
    end
end
    end
end
~~~

**Signature**

`result = notify(message)`

Send a quick plain-text notification without using a configured template. Use this for simple alerts where you do not need title/body formatting or template variables. Returns immediately after queueing the asynchronous send.

**Practical scenario**

Send notifications only for meaningful events to avoid duplicate alerts from callbacks that run repeatedly.

```lua
function onSystemMessage(message)
    if stringContains(message, "Caught") then
        function onSystemMessage(message)
    if stringContains(message, "Caught") then
        local ok = notify("PROCatchem: script reached Cerulean City.")
    end
end
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `message` | `string` | yes | Plain text message to send. |

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/notifications/notify`</small>


## setNotifyVar()

~~~ lua
function onSystemMessage(message)
    if stringContains(message, "Caught") then
        function onSystemMessage(message)
    if stringContains(message, "Caught") then
        setNotifyVar("hunt", "Shiny Magikarp")
    end
end
    end
end
~~~

**Signature**

`setNotifyVar(name, value)`

Set a runtime notification variable. The variable can be used in any template as `{name}` until it is overwritten or cleared with `clearNotifyVars()`. Values are converted to strings.

**Practical scenario**

Send notifications only for meaningful events to avoid duplicate alerts from callbacks that run repeatedly.

```lua
function onSystemMessage(message)
    if stringContains(message, "Caught") then
        function onSystemMessage(message)
    if stringContains(message, "Caught") then
        setNotifyVar("hunt", "Shiny Magikarp")
    end
end
    end
end
```

### Parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `name` | `string` | yes | Variable name without braces. |
| `value` | `LuaValue` | yes | Value to store or send. |

### Returns

`void`

<small>Source key: `POST /lua/notifications/setnotifyvar`</small>


## clearNotifyVars()

~~~ lua
function onSystemMessage(message)
    if stringContains(message, "Caught") then
        function onSystemMessage(message)
    if stringContains(message, "Caught") then
        clearNotifyVars()
    end
end
    end
end
~~~

**Signature**

`clearNotifyVars()`

Clear all runtime notification variables previously set with `setNotifyVar`. Built-in variables and configured template/default variables are not removed.

**Practical scenario**

Send notifications only for meaningful events to avoid duplicate alerts from callbacks that run repeatedly.

```lua
function onSystemMessage(message)
    if stringContains(message, "Caught") then
        function onSystemMessage(message)
    if stringContains(message, "Caught") then
        clearNotifyVars()
    end
end
    end
end
```

### Returns

`void`

<small>Source key: `POST /lua/notifications/clearnotifyvars`</small>



# Legacy special actions

## useSurf()

~~~ lua
function onPathAction()
    if not isSurfing() then
        useSurf()
        return
    end

    moveToWater()
end
~~~

**Signature**

`result = useSurf()`

Start surfing from the current position. If `setWaterMount()` configured a water mount, the tool uses that mount item; otherwise it sends the normal `/surf` action. Pathfinding also calls this automatically when a route transitions from ground to water.

**Practical scenario**

Call this at the shoreline when a scripted route needs to enter water. Pathfinding may also trigger it automatically.

```lua
function onPathAction()
    if not isSurfing() then
        useSurf()
        return
    end

    moveToWater()
end
```

### Returns

`boolean` — example: `true`

<small>Source key: `POST /lua/legacy-special-actions/usesurf`</small>


