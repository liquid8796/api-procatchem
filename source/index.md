---
title: PROCatchem Lua Script API

language_tabs:
  - lua

toc_footers:
  - <a href='openapi.yaml'>OpenAPI YAML</a>
  - <a href='examples/basic-script.lua'>Basic script example</a>
  - <a href='examples/notification-script.lua'>Notification example</a>

search: true
---


# Introduction

PROCatchem exposes a Lua API for script authors. This Slate version documents every Lua global function and script callback from the current API description.

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

A script should execute at most one path or battle action per frame. Query/helper functions can be called freely.

## PC storage note

PC storage updates are asynchronous. After deposit, withdraw, swap, internal box swap, or release, wait for the server update and re-check PC/team state before issuing the next dependent action.


# Script metadata


## name()

~~~ lua
local result = name()
~~~

**Signature**

`result = name()`

**Callback**

```lua
result = name()
```

Script display name shown in the tool.


### Returns


`string`
 — example: `"value"`



<small>Source key: `GET /lua/metadata/name`</small>


## author()

~~~ lua
local result = author()
~~~

**Signature**

`result = author()`

**Callback**

```lua
result = author()
```

Script author displayed in the tool.


### Returns


`string`
 — example: `"value"`



<small>Source key: `GET /lua/metadata/author`</small>


## description()

~~~ lua
local result = description()
~~~

**Signature**

`result = description()`

**Callback**

```lua
result = description()
```

Short script description displayed in the tool.


### Returns


`string`
 — example: `"value"`



<small>Source key: `GET /lua/metadata/description`</small>


# Lifecycle callbacks


## onStart()

~~~ lua
onStart()
~~~

**Signature**

`onStart()`

**Callback**

```lua
onStart()
```

Called when the script starts.


### Returns


`void`



<small>Source key: `POST /lua/callbacks/onStart`</small>


## onStop()

~~~ lua
onStop()
~~~

**Signature**

`onStop()`

**Callback**

```lua
onStop()
```

Called when the script stops.


### Returns


`void`



<small>Source key: `POST /lua/callbacks/onStop`</small>


## onPause()

~~~ lua
onPause()
~~~

**Signature**

`onPause()`

**Callback**

```lua
onPause()
```

Called when the script is paused.


### Returns


`void`



<small>Source key: `POST /lua/callbacks/onPause`</small>


## onResume()

~~~ lua
onResume()
~~~

**Signature**

`onResume()`

**Callback**

```lua
onResume()
```

Called when the script resumes.


### Returns


`void`



<small>Source key: `POST /lua/callbacks/onResume`</small>


## onPathAction()

~~~ lua
onPathAction()
~~~

**Signature**

`onPathAction()`

**Callback**

```lua
onPathAction()
```

Called repeatedly while the player is outside battle. Execute at most one path action per frame.


### Returns


`void`



<small>Source key: `POST /lua/callbacks/onPathAction`</small>


## onBattleAction()

~~~ lua
onBattleAction()
~~~

**Signature**

`onBattleAction()`

**Callback**

```lua
onBattleAction()
```

Called repeatedly while the player is in battle. Execute at most one battle action per frame.


### Returns


`void`



<small>Source key: `POST /lua/callbacks/onBattleAction`</small>


## onDialogMessage()

~~~ lua
onDialogMessage("Hello from PROCatchem script.")
~~~

**Signature**

`onDialogMessage(message)`

**Callback**

```lua
onDialogMessage(message)
```

Called when a dialog message is received.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `message` | `string` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/callbacks/onDialogMessage`</small>


## onBattleMessage()

~~~ lua
onBattleMessage("Hello from PROCatchem script.")
~~~

**Signature**

`onBattleMessage(message)`

**Callback**

```lua
onBattleMessage(message)
```

Called when a battle message is received.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `message` | `string` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/callbacks/onBattleMessage`</small>


## onSystemMessage()

~~~ lua
onSystemMessage("Hello from PROCatchem script.")
~~~

**Signature**

`onSystemMessage(message)`

**Callback**

```lua
onSystemMessage(message)
```

Called when a system message is received.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `message` | `string` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/callbacks/onSystemMessage`</small>


## onWarningMessage()

~~~ lua
onWarningMessage(true, 1)
~~~

**Signature**

`onWarningMessage(differentMap, distance)`

**Callback**

```lua
onWarningMessage(differentMap, distance)
```

Called when a warning message is received; distance can be -1 when unavailable.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `differentMap` | `boolean` | yes |  |

| `distance` | `integer` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/callbacks/onWarningMessage`</small>


## onLearningMove()

~~~ lua
onLearningMove("Tackle", 1)
~~~

**Signature**

`onLearningMove(moveName, pokemonIndex)`

**Callback**

```lua
onLearningMove(moveName, pokemonIndex)
```

Called when a Pokémon is learning a move.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `moveName` | `string` | yes |  |

| `pokemonIndex` | `integer` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/callbacks/onLearningMove`</small>


# Core utilities


## log()

~~~ lua
log("Hello from PROCatchem script.")
~~~

**Signature**

`log(message)`

Displays the specified message to the message log.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `message` | `string` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/core-utilities/log`</small>


## fatal()

~~~ lua
fatal("Hello from PROCatchem script.")
~~~

**Signature**

`fatal(message)`

Displays the specified message to the message log and stop the bot.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `message` | `string` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/core-utilities/fatal`</small>


## logout()

~~~ lua
logout("Hello from PROCatchem script.")
~~~

**Signature**

`logout(message)`

Displays the specified message to the message log and logs out.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `message` | `string` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/core-utilities/logout`</small>


## relog()

~~~ lua
relog(15, "Hello from PROCatchem script.")
~~~

**Signature**

`relog(delay, message)`

Logs out and logs back in after the specified number of seconds.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `delay` | `number` | yes |  |

| `message` | `string` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/core-utilities/relog`</small>


## restart()

~~~ lua
restart(15, "Hello from PROCatchem script.")
~~~

**Signature**

`restart(delay, message)`

Start the script.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `delay` | `integer` | yes |  |

| `message` | `string` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/core-utilities/restart`</small>


## stringContains()

~~~ lua
local result = stringContains("value", "value")
~~~

**Signature**

`result = stringContains(haystack, needle)`

Returns true if the string contains the specified part, ignoring the case.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `haystack` | `string` | yes |  |

| `needle` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/core-utilities/stringcontains`</small>


## playSound()

~~~ lua
playSound("logs/script.txt")
~~~

**Signature**

`playSound(file)`

Returns playing a custom sound.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `file` | `string` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/core-utilities/playsound`</small>


## registerHook()

~~~ lua
registerHook("value", {})
~~~

**Signature**

`registerHook(eventName, callback)`

Calls the specified function when the specified event occurs.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `eventName` | `string` | yes |  |

| `callback` | `object` | yes | Any Lua value. |


### Returns


`void`



<small>Source key: `POST /lua/core-utilities/registerhook`</small>


# Map and NPC


## getPlayerX()

~~~ lua
local result = getPlayerX()
~~~

**Signature**

`result = getPlayerX()`

Returns the X-coordinate of the current cell.


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/map-and-npc/getplayerx`</small>


## getPlayerY()

~~~ lua
local result = getPlayerY()
~~~

**Signature**

`result = getPlayerY()`

Returns the Y-coordinate of the current cell.


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/map-and-npc/getplayery`</small>


## getMapName()

~~~ lua
local result = getMapName()
~~~

**Signature**

`result = getMapName()`

Returns the name of the current map.


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/map-and-npc/getmapname`</small>


## getActiveBattlers()

~~~ lua
local result = getActiveBattlers()
~~~

**Signature**

`result = getActiveBattlers()`

API return an array of all NPCs that can be challenged on the current map. format : {"npcName" = {"x" = x, "y" = y}}


### Returns


`object`
 — example: `{}`



<small>Source key: `POST /lua/map-and-npc/getactivebattlers`</small>


## getActiveDigSpots()

~~~ lua
local result = getActiveDigSpots()
~~~

**Signature**

`result = getActiveDigSpots()`

API return an array of all usable Dig Spots on the currrent map. format : {index = {"x" = x, "y" = y}}


### Returns


`array<object>`
 — example: `{}`



<small>Source key: `POST /lua/map-and-npc/getactivedigspots`</small>


## getActiveHeadbuttTrees()

~~~ lua
local result = getActiveHeadbuttTrees()
~~~

**Signature**

`result = getActiveHeadbuttTrees()`

API return an array of all usable Headbutt trees on the currrent map. format : {index = {"x" = x, "y" = y}}


### Returns


`array<object>`
 — example: `{}`



<small>Source key: `POST /lua/map-and-npc/getactiveheadbutttrees`</small>


## getActiveBerryTrees()

~~~ lua
local result = getActiveBerryTrees()
~~~

**Signature**

`result = getActiveBerryTrees()`

API return an array of all harvestable berry trees on the currrent map. format : {index = {"x" = x, "y" = y}}


### Returns


`array<object>`
 — example: `{}`



<small>Source key: `POST /lua/map-and-npc/getactiveberrytrees`</small>


## getDiscoverableItems()

~~~ lua
local result = getDiscoverableItems()
~~~

**Signature**

`result = getDiscoverableItems()`

API return an array of all discoverable items on the currrent map. format : {index = {"x" = x, "y" = y}}


### Returns


`array<object>`
 — example: `{}`



<small>Source key: `POST /lua/map-and-npc/getdiscoverableitems`</small>


## getDiscoverablePokestops()

~~~ lua
local result = getDiscoverablePokestops()
~~~

**Signature**

`result = getDiscoverablePokestops()`

API return an array of all pokestops on the current map. format : {index = {"x" = x, "y" = y}}


### Returns


`array<object>`
 — example: `{}`



<small>Source key: `POST /lua/map-and-npc/getdiscoverablepokestops`</small>


## getDiscoverableAbandonedPokemon()

~~~ lua
local result = getDiscoverableAbandonedPokemon()
~~~

**Signature**

`result = getDiscoverableAbandonedPokemon()`

API return an array of all Abandoned Pokemon on the current map. format : {index = {"x" = x, "y" = y}}


### Returns


`array<object>`
 — example: `{}`



<small>Source key: `POST /lua/map-and-npc/getdiscoverableabandonedpokemon`</small>


## getNpcData()

~~~ lua
local result = getNpcData()
~~~

**Signature**

`result = getNpcData()`

Returns npc data on current map, format : { { "x" = x , "y" = y, "type" = type }, {...}, ... }


### Returns


`array<object>`
 — example: `{}`



<small>Source key: `POST /lua/map-and-npc/getnpcdata`</small>


## getMapLinks()

~~~ lua
local result = getMapLinks()
~~~

**Signature**

`result = getMapLinks()`

Lua function `getMapLinks`.


### Returns


`array<object>`
 — example: `{}`



<small>Source key: `POST /lua/map-and-npc/getmaplinks`</small>


## getMapWidth()

~~~ lua
local result = getMapWidth()
~~~

**Signature**

`result = getMapWidth()`

The number of cells on the current map in the x direction.


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/map-and-npc/getmapwidth`</small>


## getMapHeight()

~~~ lua
local result = getMapHeight()
~~~

**Signature**

`result = getMapHeight()`

The number of cells on the current map in the y direction.


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/map-and-npc/getmapheight`</small>


## getCellType()

~~~ lua
local result = getCellType(10, 15)
~~~

**Signature**

`result = getCellType(x, y)`

Returns the cell type of the specified cell on the current map.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `x` | `integer` | yes |  |

| `y` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/map-and-npc/getcelltype`</small>


## isNpcVisible()

~~~ lua
local result = isNpcVisible("Nurse Joy")
~~~

**Signature**

`result = isNpcVisible(npcName)`

Returns true if there is a visible NPC with the specified name on the map.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `npcName` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/map-and-npc/isnpcvisible`</small>


## isNpcOnCell()

~~~ lua
local result = isNpcOnCell(10, 15)
~~~

**Signature**

`result = isNpcOnCell(cellX, cellY)`

Returns true if there is a visible NPC the specified coordinates.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `cellX` | `integer` | yes |  |

| `cellY` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/map-and-npc/isnpconcell`</small>


## isInArea()

~~~ lua
local result = isInArea("value")
~~~

**Signature**

`result = isInArea(text)`

Check condition list cell

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `text` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/map-and-npc/isinarea`</small>


# General state


## getAccountName()

~~~ lua
local result = getAccountName()
~~~

**Signature**

`result = getAccountName()`

Returns current account name.


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/general-state/getaccountname`</small>


## getPokedexOwned()

~~~ lua
local result = getPokedexOwned()
~~~

**Signature**

`result = getPokedexOwned()`

Returns Owned Entry of the pokedex


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/general-state/getpokedexowned`</small>


## getPokedexSeen()

~~~ lua
local result = getPokedexSeen()
~~~

**Signature**

`result = getPokedexSeen()`

Returns Seen Entry of the pokedex


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/general-state/getpokedexseen`</small>


## getPokedexEvolved()

~~~ lua
local result = getPokedexEvolved()
~~~

**Signature**

`result = getPokedexEvolved()`

Returns Evolved Entry of the pokedex


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/general-state/getpokedexevolved`</small>


## getTeamSize()

~~~ lua
local result = getTeamSize()
~~~

**Signature**

`result = getTeamSize()`

Returns the amount of pokémon in the team.


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/general-state/getteamsize`</small>


## isGameScriptActive()

~~~ lua
local result = isGameScriptActive()
~~~

**Signature**

`result = isGameScriptActive()`

Lua function `isGameScriptActive`.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/general-state/isgamescriptactive`</small>


## isAccountMember()

~~~ lua
local result = isAccountMember()
~~~

**Signature**

`result = isAccountMember()`

Returns current account's membership status.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/general-state/isaccountmember`</small>


## getRemainingPowerPoints()

~~~ lua
local result = getRemainingPowerPoints(1, "Tackle")
~~~

**Signature**

`result = getRemainingPowerPoints(pokemonIndex, moveName)`

Returns the remaining power points of the specified move of the specified pokémon in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `pokemonIndex` | `integer` | yes |  |

| `moveName` | `string` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/general-state/getremainingpowerpoints`</small>


## isShopOpen()

~~~ lua
local result = isShopOpen()
~~~

**Signature**

`result = isShopOpen()`

Returns true if there is a shop opened.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/general-state/isshopopen`</small>


## isRelearningMoves()

~~~ lua
local result = isRelearningMoves()
~~~

**Signature**

`result = isRelearningMoves()`

Returns true if the player is relearning the move of a Pokemon from an NPC.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/general-state/isrelearningmoves`</small>


## getMoney()

~~~ lua
local result = getMoney()
~~~

**Signature**

`result = getMoney()`

Returns the amount of money in the inventory.


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/general-state/getmoney`</small>


## isMounted()

~~~ lua
local result = isMounted()
~~~

**Signature**

`result = isMounted()`

Returns true if the player is riding a mount or the bicycle.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/general-state/ismounted`</small>


## isSurfing()

~~~ lua
local result = isSurfing()
~~~

**Signature**

`result = isSurfing()`

Returns true if the player is surfing


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/general-state/issurfing`</small>


## isPrivateMessageEnabled()

~~~ lua
local result = isPrivateMessageEnabled()
~~~

**Signature**

`result = isPrivateMessageEnabled()`

Check if the private message from normal users are blocked.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/general-state/isprivatemessageenabled`</small>


## isPartyInspectionEnabled()

~~~ lua
local result = isPartyInspectionEnabled()
~~~

**Signature**

`result = isPartyInspectionEnabled()`

Check if party inspections are turned on.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/general-state/ispartyinspectionenabled`</small>


## isNpcInteractionsEnabled()

~~~ lua
local result = isNpcInteractionsEnabled()
~~~

**Signature**

`result = isNpcInteractionsEnabled()`

Returns true if the bot is checking for npc interactions.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/general-state/isnpcinteractionsenabled`</small>


## getTime()

~~~ lua
local hour, minute = getTime()
~~~

**Signature**

`hour, minute = getTime()`

Return the current in game hour and minute.


### Returns


`object`
 — example: `{"hour": 12, "minute": 34}`


Lua return values.



<small>Source key: `POST /lua/general-state/gettime`</small>


## isMorning()

~~~ lua
local result = isMorning()
~~~

**Signature**

`result = isMorning()`

Return true if morning time.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/general-state/ismorning`</small>


## isNoon()

~~~ lua
local result = isNoon()
~~~

**Signature**

`result = isNoon()`

Return true if noon time.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/general-state/isnoon`</small>


## isNight()

~~~ lua
local result = isNight()
~~~

**Signature**

`result = isNight()`

Return true if night time.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/general-state/isnight`</small>


## isOutside()

~~~ lua
local result = isOutside()
~~~

**Signature**

`result = isOutside()`

Return true if the character is outside.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/general-state/isoutside`</small>


## isAutoEvolve()

~~~ lua
local result = isAutoEvolve()
~~~

**Signature**

`result = isAutoEvolve()`

Return the state Auto Evolve


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/general-state/isautoevolve`</small>


## setMount()

~~~ lua
local result = setMount("Arcanine Mount")
~~~

**Signature**

`result = setMount(mount)`

Configure the ground mount or bike item that the bot should use while moving on outside ground maps. Pass the exact item name, for example `Arcanine Mount` or `Blue Bicycle`. Pass an empty string to clear the configured ground mount. The function only configures the item; the tool uses it automatically before movement when appropriate.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `mount` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/general-state/setmount`</small>


## setWaterMount()

~~~ lua
local result = setWaterMount("Lapras Mount")
~~~

**Signature**

`result = setWaterMount(mount)`

Configure an optional water mount item that should be used when the bot needs to start surfing. Call this before a path that may enter water. Most scripts can leave it unset; without a water mount, `useSurf()` and pathfinding use the normal `/surf` flow. Pass an empty string to clear the configured water mount.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `mount` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/general-state/setwatermount`</small>


## isCurrentPCBoxRefreshed()

~~~ lua
local result = isCurrentPCBoxRefreshed()
~~~

**Signature**

`result = isCurrentPCBoxRefreshed()`

Returns true when the latest requested PC box action has completed or there is no pending PC box refresh. Use this after `usePC()`, `openPCBox()`, or `refreshPCBox()` before reading PC Pokémon data.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/general-state/iscurrentpcboxrefreshed`</small>


## getServer()

~~~ lua
local result = getServer()
~~~

**Signature**

`result = getServer()`

Returns the connected server


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/general-state/getserver`</small>


# Team Pokémon


## getPokemonId()

~~~ lua
local result = getPokemonId(1)
~~~

**Signature**

`result = getPokemonId(index)`

Returns the ID of the specified pokémon in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/team-pok-mon/getpokemonid`</small>


## getPokemonName()

~~~ lua
local result = getPokemonName(1)
~~~

**Signature**

`result = getPokemonName(index)`

Returns the name of the specified pokémon in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/team-pok-mon/getpokemonname`</small>


## getPokemonHealth()

~~~ lua
local result = getPokemonHealth(1)
~~~

**Signature**

`result = getPokemonHealth(index)`

Returns the current health of the specified pokémon in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/team-pok-mon/getpokemonhealth`</small>


## getPokemonHealthPercent()

~~~ lua
local result = getPokemonHealthPercent(1)
~~~

**Signature**

`result = getPokemonHealthPercent(index)`

Returns the percentage of remaining health of the specified pokémon in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/team-pok-mon/getpokemonhealthpercent`</small>


## getPokemonMaxHealth()

~~~ lua
local result = getPokemonMaxHealth(1)
~~~

**Signature**

`result = getPokemonMaxHealth(index)`

Returns the maximum health of the specified pokémon in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/team-pok-mon/getpokemonmaxhealth`</small>


## getPokemonLevel()

~~~ lua
local result = getPokemonLevel(1)
~~~

**Signature**

`result = getPokemonLevel(index)`

Returns the level of the specified pokémon in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/team-pok-mon/getpokemonlevel`</small>


## getPokemonTotalExperience()

~~~ lua
local result = getPokemonTotalExperience(1)
~~~

**Signature**

`result = getPokemonTotalExperience(index)`

Returns the experience total of a pokemon level.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/team-pok-mon/getpokemontotalexperience`</small>


## getPokemonRemainingExperience()

~~~ lua
local result = getPokemonRemainingExperience(1)
~~~

**Signature**

`result = getPokemonRemainingExperience(index)`

Returns the remaining experience of a pokemon before next level.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/team-pok-mon/getpokemonremainingexperience`</small>


## getPokemonStatus()

~~~ lua
local result = getPokemonStatus(1)
~~~

**Signature**

`result = getPokemonStatus(index)`

Returns the status of the specified pokémon in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/team-pok-mon/getpokemonstatus`</small>


## getPokemonForm()

~~~ lua
local result = getPokemonForm(1)
~~~

**Signature**

`result = getPokemonForm(index)`

Returns the form of the specified pokémon in the team (0 if no form).

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/team-pok-mon/getpokemonform`</small>


## getPokemonHeldItem()

~~~ lua
local result = getPokemonHeldItem(1)
~~~

**Signature**

`result = getPokemonHeldItem(index)`

Returns the item held by the specified pokemon in the team, null if empty.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/team-pok-mon/getpokemonhelditem`</small>


## getPokemonUniqueId()

~~~ lua
local result = getPokemonUniqueId(1)
~~~

**Signature**

`result = getPokemonUniqueId(pokemonUid)`

PROCatchem unique ID of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `pokemonUid` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/team-pok-mon/getpokemonuniqueid`</small>


## getPokemonMaxPowerPoints()

~~~ lua
local result = getPokemonMaxPowerPoints(1, "Tackle")
~~~

**Signature**

`result = getPokemonMaxPowerPoints(index, moveId)`

Max move PP of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |

| `moveId` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/team-pok-mon/getpokemonmaxpowerpoints`</small>


## isPokemonShiny()

~~~ lua
local result = isPokemonShiny(1)
~~~

**Signature**

`result = isPokemonShiny(index)`

Returns the shyniness of the specified pokémon in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/team-pok-mon/ispokemonshiny`</small>


## getPokemonMoveName()

~~~ lua
local result = getPokemonMoveName(1, "Tackle")
~~~

**Signature**

`result = getPokemonMoveName(index, moveId)`

Returns the move of the specified pokémon in the team at the specified index.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |

| `moveId` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/team-pok-mon/getpokemonmovename`</small>


## getPokemonMoveAccuracy()

~~~ lua
local result = getPokemonMoveAccuracy(1, "Tackle")
~~~

**Signature**

`result = getPokemonMoveAccuracy(index, moveId)`

Returns the move accuracy of the specified pokémon in the team at the specified index.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |

| `moveId` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/team-pok-mon/getpokemonmoveaccuracy`</small>


## getPokemonMovePower()

~~~ lua
local result = getPokemonMovePower(1, "Tackle")
~~~

**Signature**

`result = getPokemonMovePower(index, moveId)`

Returns the move power of the specified pokémon in the team at the specified index.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |

| `moveId` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/team-pok-mon/getpokemonmovepower`</small>


## getPokemonMoveType()

~~~ lua
local result = getPokemonMoveType(1, "Tackle")
~~~

**Signature**

`result = getPokemonMoveType(index, moveId)`

Returns the move type of the specified pokémon in the team at the specified index.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |

| `moveId` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/team-pok-mon/getpokemonmovetype`</small>


## getPokemonMoveDamageType()

~~~ lua
local result = getPokemonMoveDamageType(1, "Tackle")
~~~

**Signature**

`result = getPokemonMoveDamageType(index, moveId)`

Returns the move damage type of the specified pokémon in the team at the specified index.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |

| `moveId` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/team-pok-mon/getpokemonmovedamagetype`</small>


## getPokemonMoveStatus()

~~~ lua
local result = getPokemonMoveStatus(1, "Tackle")
~~~

**Signature**

`result = getPokemonMoveStatus(index, moveId)`

Returns true if the move of the specified pokémon in the team at the specified index can apply a status .

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |

| `moveId` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/team-pok-mon/getpokemonmovestatus`</small>


## getPokemonNature()

~~~ lua
local result = getPokemonNature(1)
~~~

**Signature**

`result = getPokemonNature(index)`

Nature of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/team-pok-mon/getpokemonnature`</small>


## getPokemonAbility()

~~~ lua
local result = getPokemonAbility(1)
~~~

**Signature**

`result = getPokemonAbility(index)`

Ability of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/team-pok-mon/getpokemonability`</small>


## getPokemonStat()

~~~ lua
local result = getPokemonStat(1, "value")
~~~

**Signature**

`result = getPokemonStat(pokemonIndex, statType)`

Returns the value for the specified stat of the specified pokémon in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `pokemonIndex` | `integer` | yes |  |

| `statType` | `string` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/team-pok-mon/getpokemonstat`</small>


## getPokemonEffortValue()

~~~ lua
local result = getPokemonEffortValue(1, "value")
~~~

**Signature**

`result = getPokemonEffortValue(pokemonIndex, statType)`

Returns the effort value for the specified stat of the specified pokémon in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `pokemonIndex` | `integer` | yes |  |

| `statType` | `string` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/team-pok-mon/getpokemoneffortvalue`</small>


## getPokemonIndividualValue()

~~~ lua
local result = getPokemonIndividualValue(1, "value")
~~~

**Signature**

`result = getPokemonIndividualValue(pokemonIndex, statType)`

Returns the individual value for the specified stat of the specified pokémon in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `pokemonIndex` | `integer` | yes |  |

| `statType` | `string` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/team-pok-mon/getpokemonindividualvalue`</small>


## getPokemonHappiness()

~~~ lua
local result = getPokemonHappiness(1)
~~~

**Signature**

`result = getPokemonHappiness(index)`

Returns the happiness of the specified pokémon in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/team-pok-mon/getpokemonhappiness`</small>


## getPokemonRegion()

~~~ lua
local result = getPokemonRegion(1)
~~~

**Signature**

`result = getPokemonRegion(index)`

Returns the region of capture of the specified pokémon in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/team-pok-mon/getpokemonregion`</small>


## getPokemonOriginalTrainer()

~~~ lua
local result = getPokemonOriginalTrainer(1)
~~~

**Signature**

`result = getPokemonOriginalTrainer(index)`

Returns the original trainer of the specified pokémon in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/team-pok-mon/getpokemonoriginaltrainer`</small>


## getPokemonGender()

~~~ lua
local result = getPokemonGender(1)
~~~

**Signature**

`result = getPokemonGender(index)`

Returns the gender of the specified pokémon in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/team-pok-mon/getpokemongender`</small>


## getPokemonType()

~~~ lua
local result = getPokemonType(1)
~~~

**Signature**

`result = getPokemonType(index)`

Returns the type of the specified pokémon in the team as an array of length 2.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`array<string>`
 — example: `[]`



<small>Source key: `POST /lua/team-pok-mon/getpokemontype`</small>


## getDamageMultiplier()

~~~ lua
local result = getDamageMultiplier("value", 1, 2)
~~~

**Signature**

`result = getDamageMultiplier(attacker, ...)`

Returns the multiplier of the damage type between an attacking type and one or two defending types.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `attacker` | `string` | yes |  |

| `defender` | `array<object>` | yes |  |


### Returns


`number`
 — example: `1.0`



<small>Source key: `POST /lua/team-pok-mon/getdamagemultiplier`</small>


## isPokemonUsable()

~~~ lua
local result = isPokemonUsable(1)
~~~

**Signature**

`result = isPokemonUsable(index)`

Returns true if the specified pokémon has is alive and has an offensive attack available.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/team-pok-mon/ispokemonusable`</small>


## getUsablePokemonCount()

~~~ lua
local result = getUsablePokemonCount()
~~~

**Signature**

`result = getUsablePokemonCount()`

Returns the amount of usable pokémon in the team.


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/team-pok-mon/getusablepokemoncount`</small>


## hasMove()

~~~ lua
local result = hasMove(1, "Tackle")
~~~

**Signature**

`result = hasMove(pokemonIndex, moveName)`

Returns true if the specified pokémon has a move with the specified name.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `pokemonIndex` | `integer` | yes |  |

| `moveName` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/team-pok-mon/hasmove`</small>


## hasPokemonInTeam()

~~~ lua
local result = hasPokemonInTeam("value")
~~~

**Signature**

`result = hasPokemonInTeam(pokemonName)`

Returns true if the specified pokémon is present in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `pokemonName` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/team-pok-mon/haspokemoninteam`</small>


## isTeamSortedByLevelAscending()

~~~ lua
local result = isTeamSortedByLevelAscending()
~~~

**Signature**

`result = isTeamSortedByLevelAscending()`

Returns true if the team is sorted by level in ascending order.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/team-pok-mon/isteamsortedbylevelascending`</small>


## isTeamSortedByLevelDescending()

~~~ lua
local result = isTeamSortedByLevelDescending()
~~~

**Signature**

`result = isTeamSortedByLevelDescending()`

Returns true if the team is sorted by level in descending order.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/team-pok-mon/isteamsortedbyleveldescending`</small>


## isTeamRangeSortedByLevelAscending()

~~~ lua
local result = isTeamRangeSortedByLevelAscending(10, 10)
~~~

**Signature**

`result = isTeamRangeSortedByLevelAscending(fromIndex, toIndex)`

Returns true if the specified part of the team is sorted by level in ascending order.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `fromIndex` | `integer` | yes |  |

| `toIndex` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/team-pok-mon/isteamrangesortedbylevelascending`</small>


## isTeamRangeSortedByLevelDescending()

~~~ lua
local result = isTeamRangeSortedByLevelDescending(10, 10)
~~~

**Signature**

`result = isTeamRangeSortedByLevelDescending(fromIndex, toIndex)`

Returns true if the specified part of the team the team is sorted by level in descending order.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `fromIndex` | `integer` | yes |  |

| `toIndex` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/team-pok-mon/isteamrangesortedbyleveldescending`</small>


# Items and shop


## hasItem()

~~~ lua
local result = hasItem("Potion")
~~~

**Signature**

`result = hasItem(itemName)`

Returns true if the specified item is in the inventory.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `itemName` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/items-and-shop/hasitem`</small>


## getItemQuantity()

~~~ lua
local result = getItemQuantity("Potion")
~~~

**Signature**

`result = getItemQuantity(itemName)`

Returns the quantity of the specified item in the inventory.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `itemName` | `string` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/items-and-shop/getitemquantity`</small>


## hasItemId()

~~~ lua
local result = hasItemId("Potion")
~~~

**Signature**

`result = hasItemId(itemid)`

Returns true if the specified item is in the inventory.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `itemid` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/items-and-shop/hasitemid`</small>


## getItemQuantityId()

~~~ lua
local result = getItemQuantityId("Potion")
~~~

**Signature**

`result = getItemQuantityId(itemid)`

Returns the quantity of the specified item in the inventory.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `itemid` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/items-and-shop/getitemquantityid`</small>


## buyItem()

~~~ lua
local result = buyItem("Potion", 15)
~~~

**Signature**

`result = buyItem(itemName, quantity)`

Buys the specified item from the opened shop.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `itemName` | `string` | yes |  |

| `quantity` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/items-and-shop/buyitem`</small>


## hasShopItem()

~~~ lua
local result = hasShopItem("Potion")
~~~

**Signature**

`result = hasShopItem(itemName)`

Lua function `hasShopItem`.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `itemName` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/items-and-shop/hasshopitem`</small>


## giveItemToPokemon()

~~~ lua
local result = giveItemToPokemon("Potion", 1)
~~~

**Signature**

`result = giveItemToPokemon(itemName, pokemonIndex)`

Give the specified item on the specified pokemon.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `itemName` | `string` | yes |  |

| `pokemonIndex` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/items-and-shop/giveitemtopokemon`</small>


## takeItemFromPokemon()

~~~ lua
local result = takeItemFromPokemon(1)
~~~

**Signature**

`result = takeItemFromPokemon(index)`

Take the held item from the specified pokemon.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/items-and-shop/takeitemfrompokemon`</small>


## useItem()

~~~ lua
local result = useItem("Potion")
~~~

**Signature**

`result = useItem(itemName)`

Uses the specified item.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `itemName` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/items-and-shop/useitem`</small>


## useItemOnPokemon()

~~~ lua
local result = useItemOnPokemon("Potion", 1)
~~~

**Signature**

`result = useItemOnPokemon(itemName, pokemonIndex)`

Uses the specified item on the specified pokémon.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `itemName` | `string` | yes |  |

| `pokemonIndex` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/items-and-shop/useitemonpokemon`</small>


# PC storage


## getCurrentPCBoxId()

~~~ lua
local result = getCurrentPCBoxId()
~~~

**Signature**

`result = getCurrentPCBoxId()`

Get the active PC Box.


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getcurrentpcboxid`</small>


## isPCOpen()

~~~ lua
local result = isPCOpen()
~~~

**Signature**

`result = isPCOpen()`

Check if the PC is open. Moving close the PC, usePC() opens it.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/pc-storage/ispcopen`</small>


## getCurrentPCBoxSize()

~~~ lua
local result = getCurrentPCBoxSize()
~~~

**Signature**

`result = getCurrentPCBoxSize()`

Returns the number of Pokémon currently cached in the visible PC box. PC boxes can hold up to 30 slots; use this as the safe upper bound for one-based `boxPokemonId` indexes after the box is refreshed.


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getcurrentpcboxsize`</small>


## getPCBoxCount()

~~~ lua
local result = getPCBoxCount()
~~~

**Signature**

`result = getPCBoxCount()`

Return the number of non-empty boxes in the PC


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getpcboxcount`</small>


## getPCPokemonCount()

~~~ lua
local result = getPCPokemonCount()
~~~

**Signature**

`result = getPCPokemonCount()`

Returns the latest known total Pokémon count for the current PC storage view. The value is read from server PC metadata when available and should not be inferred from internal slot IDs.


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getpcpokemoncount`</small>


## getPokemonIdFromPC()

~~~ lua
local result = getPokemonIdFromPC(1, 1)
~~~

**Signature**

`result = getPokemonIdFromPC(boxId, boxPokemonId)`

Pokedex ID of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getpokemonidfrompc`</small>


## getPokemonNameFromPC()

~~~ lua
local result = getPokemonNameFromPC(1, 1)
~~~

**Signature**

`result = getPokemonNameFromPC(boxId, boxPokemonId)`

Name of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/pc-storage/getpokemonnamefrompc`</small>


## getPokemonHealthFromPC()

~~~ lua
local result = getPokemonHealthFromPC(1, 1)
~~~

**Signature**

`result = getPokemonHealthFromPC(boxId, boxPokemonId)`

Current HP of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getpokemonhealthfrompc`</small>


## getPokemonHealthPercentFromPC()

~~~ lua
local result = getPokemonHealthPercentFromPC(1, 1)
~~~

**Signature**

`result = getPokemonHealthPercentFromPC(boxId, boxPokemonId)`

Returns the percentage of remaining health of the specified pokémon in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getpokemonhealthpercentfrompc`</small>


## getPokemonMaxHealthFromPC()

~~~ lua
local result = getPokemonMaxHealthFromPC(1, 1)
~~~

**Signature**

`result = getPokemonMaxHealthFromPC(boxId, boxPokemonId)`

Max HP of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getpokemonmaxhealthfrompc`</small>


## getPokemonLevelFromPC()

~~~ lua
local result = getPokemonLevelFromPC(1, 1)
~~~

**Signature**

`result = getPokemonLevelFromPC(boxId, boxPokemonId)`

Level of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getpokemonlevelfrompc`</small>


## getPokemonTotalExperienceFromPC()

~~~ lua
local result = getPokemonTotalExperienceFromPC(1, 1)
~~~

**Signature**

`result = getPokemonTotalExperienceFromPC(boxId, boxPokemonId)`

Total of experience cost of a level for the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getpokemontotalexperiencefrompc`</small>


## getPokemonRemainingExperienceFromPC()

~~~ lua
local result = getPokemonRemainingExperienceFromPC(1, 1)
~~~

**Signature**

`result = getPokemonRemainingExperienceFromPC(boxId, boxPokemonId)`

Remaining experience before the next level of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getpokemonremainingexperiencefrompc`</small>


## getPokemonStatusFromPC()

~~~ lua
local result = getPokemonStatusFromPC(1, 1)
~~~

**Signature**

`result = getPokemonStatusFromPC(boxId, boxPokemonId)`

Status of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/pc-storage/getpokemonstatusfrompc`</small>


## getPokemonTypeFromPC()

~~~ lua
local result = getPokemonTypeFromPC(1, 1)
~~~

**Signature**

`result = getPokemonTypeFromPC(boxId, boxPokemonId)`

Type of the pokemon of the current box matching the ID as an array of length 2.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`array<string>`
 — example: `[]`



<small>Source key: `POST /lua/pc-storage/getpokemontypefrompc`</small>


## getPokemonHeldItemFromPC()

~~~ lua
local result = getPokemonHeldItemFromPC(1, 1)
~~~

**Signature**

`result = getPokemonHeldItemFromPC(boxId, boxPokemonId)`

Returns the item held by the specified pokemon in the PC, null if empty.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/pc-storage/getpokemonhelditemfrompc`</small>


## getPokemonUniqueIdFromPC()

~~~ lua
local result = getPokemonUniqueIdFromPC(1, 1)
~~~

**Signature**

`result = getPokemonUniqueIdFromPC(boxId, boxPokemonId)`

PROCatchem custom unique ID of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getpokemonuniqueidfrompc`</small>


## getPokemonRemainingPowerPointsFromPC()

~~~ lua
local result = getPokemonRemainingPowerPointsFromPC(1, 1, "Tackle")
~~~

**Signature**

`result = getPokemonRemainingPowerPointsFromPC(boxId, boxPokemonId, moveId)`

Current move PP of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |

| `moveId` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getpokemonremainingpowerpointsfrompc`</small>


## getPokemonMaxPowerPointsFromPC()

~~~ lua
local result = getPokemonMaxPowerPointsFromPC(1, 1, "Tackle")
~~~

**Signature**

`result = getPokemonMaxPowerPointsFromPC(boxId, boxPokemonId, moveId)`

Max move PP of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |

| `moveId` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getpokemonmaxpowerpointsfrompc`</small>


## isPokemonFromPCShiny()

~~~ lua
local result = isPokemonFromPCShiny(1, 1)
~~~

**Signature**

`result = isPokemonFromPCShiny(boxId, boxPokemonId)`

Shyniness of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/pc-storage/ispokemonfrompcshiny`</small>


## getPokemonMoveNameFromPC()

~~~ lua
local result = getPokemonMoveNameFromPC(1, 1, "Tackle")
~~~

**Signature**

`result = getPokemonMoveNameFromPC(boxId, boxPokemonId, moveId)`

Move of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |

| `moveId` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/pc-storage/getpokemonmovenamefrompc`</small>


## getPokemonMoveAccuracyFromPC()

~~~ lua
local result = getPokemonMoveAccuracyFromPC(1, 1, "Tackle")
~~~

**Signature**

`result = getPokemonMoveAccuracyFromPC(boxId, boxPokemonId, moveId)`

Returns the move accuracy of the specified pokémon in the box at the specified index.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |

| `moveId` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getpokemonmoveaccuracyfrompc`</small>


## getPokemonMovePowerFromPC()

~~~ lua
local result = getPokemonMovePowerFromPC(1, 1, "Tackle")
~~~

**Signature**

`result = getPokemonMovePowerFromPC(boxId, boxPokemonId, moveId)`

Returns the move power of the specified pokémon in the box at the specified index.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |

| `moveId` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getpokemonmovepowerfrompc`</small>


## getPokemonMoveTypeFromPC()

~~~ lua
local result = getPokemonMoveTypeFromPC(1, 1, "Tackle")
~~~

**Signature**

`result = getPokemonMoveTypeFromPC(boxId, boxPokemonId, moveId)`

Returns the move type of the specified pokémon in the box at the specified index.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |

| `moveId` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/pc-storage/getpokemonmovetypefrompc`</small>


## getPokemonMoveDamageTypeFromPC()

~~~ lua
local result = getPokemonMoveDamageTypeFromPC(1, 1, "Tackle")
~~~

**Signature**

`result = getPokemonMoveDamageTypeFromPC(boxId, boxPokemonId, moveId)`

Returns the move damage type of the specified pokémon in the box at the specified index.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |

| `moveId` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/pc-storage/getpokemonmovedamagetypefrompc`</small>


## getPokemonMoveStatusFromPC()

~~~ lua
local result = getPokemonMoveStatusFromPC(1, 1, "Tackle")
~~~

**Signature**

`result = getPokemonMoveStatusFromPC(boxId, boxPokemonId, moveId)`

Returns true if the move of the specified pokémon in the box at the specified index can apply a status .

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |

| `moveId` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/pc-storage/getpokemonmovestatusfrompc`</small>


## getPokemonNatureFromPC()

~~~ lua
local result = getPokemonNatureFromPC(1, 1)
~~~

**Signature**

`result = getPokemonNatureFromPC(boxId, boxPokemonId)`

Nature of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/pc-storage/getpokemonnaturefrompc`</small>


## getPokemonAbilityFromPC()

~~~ lua
local result = getPokemonAbilityFromPC(1, 1)
~~~

**Signature**

`result = getPokemonAbilityFromPC(boxId, boxPokemonId)`

Ability of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/pc-storage/getpokemonabilityfrompc`</small>


## getPokemonStatFromPC()

~~~ lua
local result = getPokemonStatFromPC(1, 1, "value")
~~~

**Signature**

`result = getPokemonStatFromPC(boxId, boxPokemonId, statType)`

Returns the value for the specified stat of the specified pokémon in the PC.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |

| `statType` | `string` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getpokemonstatfrompc`</small>


## getPokemonEffortValueFromPC()

~~~ lua
local result = getPokemonEffortValueFromPC(1, 1, "value")
~~~

**Signature**

`result = getPokemonEffortValueFromPC(boxId, boxPokemonId, statType)`

Returns the effort value for the specified stat of the specified pokémon in the PC.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |

| `statType` | `string` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getpokemoneffortvaluefrompc`</small>


## getPokemonIndividualValueFromPC()

~~~ lua
local result = getPokemonIndividualValueFromPC(1, 1, "value")
~~~

**Signature**

`result = getPokemonIndividualValueFromPC(boxId, boxPokemonId, statType)`

Returns the individual value for the specified stat of the specified pokémon in the PC.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |

| `statType` | `string` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getpokemonindividualvaluefrompc`</small>


## getPokemonHappinessFromPC()

~~~ lua
local result = getPokemonHappinessFromPC(1, 1)
~~~

**Signature**

`result = getPokemonHappinessFromPC(boxId, boxPokemonId)`

Happiness of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getpokemonhappinessfrompc`</small>


## getPokemonRegionFromPC()

~~~ lua
local result = getPokemonRegionFromPC(1, 1)
~~~

**Signature**

`result = getPokemonRegionFromPC(boxId, boxPokemonId)`

Region of capture of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/pc-storage/getpokemonregionfrompc`</small>


## getPokemonOriginalTrainerFromPC()

~~~ lua
local result = getPokemonOriginalTrainerFromPC(1, 1)
~~~

**Signature**

`result = getPokemonOriginalTrainerFromPC(boxId, boxPokemonId)`

Original trainer of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/pc-storage/getpokemonoriginaltrainerfrompc`</small>


## getPokemonGenderFromPC()

~~~ lua
local result = getPokemonGenderFromPC(1, 1)
~~~

**Signature**

`result = getPokemonGenderFromPC(boxId, boxPokemonId)`

Gender of the pokemon of the current box matching the ID.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/pc-storage/getpokemongenderfrompc`</small>


## getPokemonFormFromPC()

~~~ lua
local result = getPokemonFormFromPC(1, 1)
~~~

**Signature**

`result = getPokemonFormFromPC(boxId, boxPokemonId)`

Form of the pokémon in the current box matching the ID. (0 if no form)

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/pc-storage/getpokemonformfrompc`</small>


## usePC()

~~~ lua
local result = usePC()
~~~

**Signature**

`result = usePC()`

Move next to the map PC when needed, open Pokémon Storage, and request the current PC box. The PC opens using the official storage flow and remains open until closed by movement or another PC action. Use `isCurrentPCBoxRefreshed()` before relying on the refreshed box contents.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/pc-storage/usepc`</small>


## openPCBox()

~~~ lua
local result = openPCBox(1)
~~~

**Signature**

`result = openPCBox(boxId)`

Open or refresh a PC box by its one-based box number. The visible box order uses one-based `boxPokemonId` indexes, while the tool internally tracks server database IDs and PC slot IDs. Wait for `isCurrentPCBoxRefreshed()` before reading the box immediately after opening it.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/pc-storage/openpcbox`</small>


## depositPokemonToPC()

~~~ lua
local result = depositPokemonToPC(2)
~~~

**Signature**

`result = depositPokemonToPC(teamPokemonId)`

Send the Pokémon at the one-based team index into the currently open PC box. The tool resolves the selected team Pokémon to its server database ID and waits for the server PC delta update instead of forcing an immediate full refresh. Re-check team/PC state before issuing a dependent action.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `teamPokemonId` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/pc-storage/depositpokemontopc`</small>


## withdrawPokemonFromPC()

~~~ lua
local result = withdrawPokemonFromPC(1, 1)
~~~

**Signature**

`result = withdrawPokemonFromPC(boxId, boxPokemonId)`

Move the Pokémon at the one-based PC box index into the team. The tool resolves the selected PC Pokémon to its server database ID and waits for the normal team update plus PC delta remove response. The target `boxId` should match the visible/refreshed PC box.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/pc-storage/withdrawpokemonfrompc`</small>


## swapPokemonFromPC()

~~~ lua
local result = swapPokemonFromPC(1, 1, 2)
~~~

**Signature**

`result = swapPokemonFromPC(boxId, boxPokemonId, teamPokemonId)`

Swap the Pokémon at the one-based team index with the Pokémon at the one-based index in the selected PC box. The tool sends the official database-ID swap packet and applies the server PC delta update, so the PC Pokémon can be at any position in the box, including the first slot.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |

| `teamPokemonId` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/pc-storage/swappokemonfrompc`</small>


## swapPokemonWithinPC()

~~~ lua
local result = swapPokemonWithinPC(1, 1, 2)
~~~

**Signature**

`result = swapPokemonWithinPC(boxId, firstBoxPokemonId, secondBoxPokemonId)`

Swap two Pokémon positions inside the same visible PC box. Both PC indexes are one-based. The server returns a position-pair delta, and the tool updates the cached PC slot order without refreshing the full box.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `firstBoxPokemonId` | `integer` | yes |  |

| `secondBoxPokemonId` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/pc-storage/swappokemonwithinpc`</small>


## releasePokemonFromPC()

~~~ lua
local result = releasePokemonFromPC(1, 1)
~~~

**Signature**

`result = releasePokemonFromPC(boxId, boxPokemonId)`

Permanently release/delete the Pokémon at the one-based index in the selected PC box. This cannot be undone. The tool resolves the Pokémon database ID, sends the official release packet, and waits for the server PC delta remove update.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |

| `boxPokemonId` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/pc-storage/releasepokemonfrompc`</small>


## refreshPCBox()

~~~ lua
local result = refreshPCBox(1)
~~~

**Signature**

`result = refreshPCBox(boxId)`

Request a refresh for the specified PC box. The response can be a full box snapshot, a metadata-only update, or a delta update. Use `isCurrentPCBoxRefreshed()` before reading the refreshed contents immediately after this call.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `boxId` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/pc-storage/refreshpcbox`</small>


# Battle state


## isOpponentShiny()

~~~ lua
local result = isOpponentShiny()
~~~

**Signature**

`result = isOpponentShiny()`

Returns true if the opponent pokémon is shiny.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/battle-state/isopponentshiny`</small>


## isAlreadyCaught()

~~~ lua
local result = isAlreadyCaught()
~~~

**Signature**

`result = isAlreadyCaught()`

Returns true if the opponent pokémon has already been caught and has a pokédex entry.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/battle-state/isalreadycaught`</small>


## isWildBattle()

~~~ lua
local result = isWildBattle()
~~~

**Signature**

`result = isWildBattle()`

Returns true if the current battle is against a wild pokémon.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/battle-state/iswildbattle`</small>


## getActivePokemonNumber()

~~~ lua
local result = getActivePokemonNumber()
~~~

**Signature**

`result = getActivePokemonNumber()`

Returns the index of the active team pokémon in the current battle.


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/battle-state/getactivepokemonnumber`</small>


## getOpponentId()

~~~ lua
local result = getOpponentId()
~~~

**Signature**

`result = getOpponentId()`

Returns the id of the opponent pokémon in the current battle.


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/battle-state/getopponentid`</small>


## getOpponentName()

~~~ lua
local result = getOpponentName()
~~~

**Signature**

`result = getOpponentName()`

Returns the name of the opponent pokémon in the current battle.


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/battle-state/getopponentname`</small>


## getOpponentHealth()

~~~ lua
local result = getOpponentHealth()
~~~

**Signature**

`result = getOpponentHealth()`

Returns the current health of the opponent pokémon in the current battle.


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/battle-state/getopponenthealth`</small>


## getOpponentMaxHealth()

~~~ lua
local result = getOpponentMaxHealth()
~~~

**Signature**

`result = getOpponentMaxHealth()`

Returns the maximum health of the opponent pokémon in the current battle.


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/battle-state/getopponentmaxhealth`</small>


## getOpponentHealthPercent()

~~~ lua
local result = getOpponentHealthPercent()
~~~

**Signature**

`result = getOpponentHealthPercent()`

Returns the percentage of remaining health of the opponent pokémon in the current battle.


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/battle-state/getopponenthealthpercent`</small>


## getOpponentLevel()

~~~ lua
local result = getOpponentLevel()
~~~

**Signature**

`result = getOpponentLevel()`

Returns the level of the opponent pokémon in the current battle.


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/battle-state/getopponentlevel`</small>


## getOpponentStatus()

~~~ lua
local result = getOpponentStatus()
~~~

**Signature**

`result = getOpponentStatus()`

Returns the status of the opponent pokémon in the current battle.


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/battle-state/getopponentstatus`</small>


## getOpponentForm()

~~~ lua
local result = getOpponentForm()
~~~

**Signature**

`result = getOpponentForm()`

Returns the form of the opponent pokémon in the current battle (0 if no form).


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/battle-state/getopponentform`</small>


## isOpponentEffortValue()

~~~ lua
local result = isOpponentEffortValue("value")
~~~

**Signature**

`result = isOpponentEffortValue(statType)`

Returns true if the opponent is only giving the specified effort value.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `statType` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/battle-state/isopponenteffortvalue`</small>


## getOpponentEffortValue()

~~~ lua
local result = getOpponentEffortValue("value")
~~~

**Signature**

`result = getOpponentEffortValue(statType)`

Returns the amount of a particular EV given by the opponent.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `statType` | `string` | yes |  |


### Returns


`integer`
 — example: `1`



<small>Source key: `POST /lua/battle-state/getopponenteffortvalue`</small>


## getOpponentType()

~~~ lua
local result = getOpponentType()
~~~

**Signature**

`result = getOpponentType()`

Returns the type of the opponent pokémon in the current battle as an array of length 2.


### Returns


`array<string>`
 — example: `[]`



<small>Source key: `POST /lua/battle-state/getopponenttype`</small>


# Path actions


## moveToCell()

~~~ lua
local result = moveToCell(10, 15)
~~~

**Signature**

`result = moveToCell(x, y)`

Moves to the specified coordinates.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `x` | `integer` | yes |  |

| `y` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/movetocell`</small>


## moveToListCell()

~~~ lua
local result = moveToListCell("value", "value")
~~~

**Signature**

`result = moveToListCell(list, "")`

Moves to the specified list coordinates.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `list` | `string` | yes |  |

| `""` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/movetolistcell`</small>


## moveToMap()

~~~ lua
local result = moveToMap("Viridian City")
~~~

**Signature**

`result = moveToMap(mapName)`

Moves to the nearest cell teleporting to the specified map.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `mapName` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/movetomap`</small>


## moveToRectangle()

~~~ lua
local result = moveToRectangle(1, 2)
~~~

**Signature**

`result = moveToRectangle(...)`

Moves to a random accessible cell of the specified rectangle.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `arg1` | `array<object>` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/movetorectangle`</small>


## moveToNormalGround()

~~~ lua
local result = moveToNormalGround()
~~~

**Signature**

`result = moveToNormalGround()`

Move randomly avoiding water and links.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/movetonormalground`</small>


## moveToGrass()

~~~ lua
local result = moveToGrass()
~~~

**Signature**

`result = moveToGrass()`

Moves to the nearest grass patch then move randomly inside it.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/movetograss`</small>


## moveToWater()

~~~ lua
local result = moveToWater()
~~~

**Signature**

`result = moveToWater()`

Moves to the nearest water area then move randomly inside it.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/movetowater`</small>


## moveNearExit()

~~~ lua
local result = moveNearExit("Viridian City")
~~~

**Signature**

`result = moveNearExit(mapName)`

Moves near the cell teleporting to the specified map.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `mapName` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/movenearexit`</small>


## talkToNpc()

~~~ lua
local result = talkToNpc("Nurse Joy")
~~~

**Signature**

`result = talkToNpc(npcName)`

Moves then talk to NPC specified by its name.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `npcName` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/talktonpc`</small>


## talkToNpcOnCell()

~~~ lua
local result = talkToNpcOnCell(10, 15)
~~~

**Signature**

`result = talkToNpcOnCell(cellX, cellY)`

Moves then talk to NPC located on the specified cell.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `cellX` | `integer` | yes |  |

| `cellY` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/talktonpconcell`</small>


## usePokecenter()

~~~ lua
local result = usePokecenter()
~~~

**Signature**

`result = usePokecenter()`

Moves to the Nurse Joy then talk to the cell below her.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/usepokecenter`</small>


## swapPokemon()

~~~ lua
local result = swapPokemon(1, 1)
~~~

**Signature**

`result = swapPokemon(index1, index2)`

Swaps the two pokémon specified by their position in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index1` | `integer` | yes |  |

| `index2` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/swappokemon`</small>


## swapPokemonWithLeader()

~~~ lua
local result = swapPokemonWithLeader("value")
~~~

**Signature**

`result = swapPokemonWithLeader(pokemonName)`

Swaps the first pokémon with the specified name with the leader of the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `pokemonName` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/swappokemonwithleader`</small>


## sortTeamByLevelAscending()

~~~ lua
local result = sortTeamByLevelAscending()
~~~

**Signature**

`result = sortTeamByLevelAscending()`

Sorts the pokémon in the team by level in ascending order, one pokémon at a time.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/sortteambylevelascending`</small>


## sortTeamByLevelDescending()

~~~ lua
local result = sortTeamByLevelDescending()
~~~

**Signature**

`result = sortTeamByLevelDescending()`

Sorts the pokémon in the team by level in descending order, one pokémon at a time.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/sortteambyleveldescending`</small>


## sortTeamRangeByLevelAscending()

~~~ lua
local result = sortTeamRangeByLevelAscending(10, 10)
~~~

**Signature**

`result = sortTeamRangeByLevelAscending(fromIndex, toIndex)`

Sorts the specified part of the team by level in ascending order, one pokémon at a time.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `fromIndex` | `integer` | yes |  |

| `toIndex` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/sortteamrangebylevelascending`</small>


## sortTeamRangeByLevelDescending()

~~~ lua
local result = sortTeamRangeByLevelDescending(10, 10)
~~~

**Signature**

`result = sortTeamRangeByLevelDescending(fromIndex, toIndex)`

Sorts the specified part of the team by level in descending order, one pokémon at a time.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `fromIndex` | `integer` | yes |  |

| `toIndex` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/sortteamrangebyleveldescending`</small>


## relearnMove()

~~~ lua
local result = relearnMove("Tackle")
~~~

**Signature**

`result = relearnMove(moveName)`

Relearn a move from the move relearner NPC.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `moveName` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/relearnmove`</small>


## releasePokemonFromTeam()

~~~ lua
local result = releasePokemonFromTeam(1)
~~~

**Signature**

`result = releasePokemonFromTeam(pokemonUid)`

Releases the specified pokemon in the team.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `pokemonUid` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/releasepokemonfromteam`</small>


## enablePrivateMessage()

~~~ lua
local result = enablePrivateMessage()
~~~

**Signature**

`result = enablePrivateMessage()`

Enable private messages from users.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/enableprivatemessage`</small>


## disablePrivateMessage()

~~~ lua
local result = disablePrivateMessage()
~~~

**Signature**

`result = disablePrivateMessage()`

Disable private messages from users.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/disableprivatemessage`</small>


## enablePartyInspection()

~~~ lua
local result = enablePartyInspection()
~~~

**Signature**

`result = enablePartyInspection()`

Enable party inspection from users.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/enablepartyinspection`</small>


## disablePartyInspection()

~~~ lua
local result = disablePartyInspection()
~~~

**Signature**

`result = disablePartyInspection()`

Disable party inspection from users.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/disablepartyinspection`</small>


## enableAutoEvolve()

~~~ lua
local result = enableAutoEvolve()
~~~

**Signature**

`result = enableAutoEvolve()`

Enable auto evolve on Pkm Catchem client.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/enableautoevolve`</small>


## disableAutoEvolve()

~~~ lua
local result = disableAutoEvolve()
~~~

**Signature**

`result = disableAutoEvolve()`

Disable auto evolve on Pkm Catchem client.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/disableautoevolve`</small>


## enableNpcInteractions()

~~~ lua
local result = enableNpcInteractions()
~~~

**Signature**

`result = enableNpcInteractions()`

Enables npc interactions.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/enablenpcinteractions`</small>


## disableNpcInteractions()

~~~ lua
local result = disableNpcInteractions()
~~~

**Signature**

`result = disableNpcInteractions()`

Disables npc interactions.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/path-actions/disablenpcinteractions`</small>


# Dialog functions


## pushDialogAnswer()

~~~ lua
pushDialogAnswer({})
~~~

**Signature**

`pushDialogAnswer(answerValue)`

Adds the specified answer to the answer queue. It will be used in the next dialog.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `answerValue` | `object` | yes | Any Lua value. |


### Returns


`void`



<small>Source key: `POST /lua/dialog-functions/pushdialoganswer`</small>


# Battle actions


## attack()

~~~ lua
local result = attack()
~~~

**Signature**

`result = attack()`

Uses the most effective offensive move available.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/battle-actions/attack`</small>


## weakAttack()

~~~ lua
local result = weakAttack()
~~~

**Signature**

`result = weakAttack()`

Uses the least effective offensive move available.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/battle-actions/weakattack`</small>


## run()

~~~ lua
local result = run()
~~~

**Signature**

`result = run()`

Tries to escape from the current wild battle.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/battle-actions/run`</small>


## sendUsablePokemon()

~~~ lua
local result = sendUsablePokemon()
~~~

**Signature**

`result = sendUsablePokemon()`

Sends the first usable pokemon different from the active one.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/battle-actions/sendusablepokemon`</small>


## sendAnyPokemon()

~~~ lua
local result = sendAnyPokemon()
~~~

**Signature**

`result = sendAnyPokemon()`

Sends the first available pokemon different from the active one.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/battle-actions/sendanypokemon`</small>


## sendPokemon()

~~~ lua
local result = sendPokemon(1)
~~~

**Signature**

`result = sendPokemon(index)`

Sends the specified pokemon to battle.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/battle-actions/sendpokemon`</small>


## useMove()

~~~ lua
local result = useMove("Tackle")
~~~

**Signature**

`result = useMove(moveName)`

Uses the specified move in the current battle if available.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `moveName` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/battle-actions/usemove`</small>


## useAnyMove()

~~~ lua
local result = useAnyMove()
~~~

**Signature**

`result = useAnyMove()`

Uses the first available move or struggle if out of PP.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/battle-actions/useanymove`</small>


# Bot configuration


## setAfk()

~~~ lua
local result = setAfk(1)
~~~

**Signature**

`result = setAfk(value)`

Sets afk timeout for BOT

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `value` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/bot-configuration/setafk`</small>


## setAfkTimeout()

~~~ lua
local result = setAfkTimeout(1)
~~~

**Signature**

`result = setAfkTimeout(value)`

Sets afk timeout for BOT

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `value` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/bot-configuration/setafktimeout`</small>


# Move learning actions


## forgetMove()

~~~ lua
local result = forgetMove("Tackle")
~~~

**Signature**

`result = forgetMove(moveName)`

Forgets the specified move, if existing, in order to learn a new one.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `moveName` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/move-learning-actions/forgetmove`</small>


## forgetAnyMoveExcept()

~~~ lua
local result = forgetAnyMoveExcept(1, 2)
~~~

**Signature**

`result = forgetAnyMoveExcept(...)`

Forgets the first move that is not one of the specified moves.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `moveNames` | `array<object>` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/move-learning-actions/forgetanymoveexcept`</small>


# Custom options


## setOption()

~~~ lua
setOption(1, true)
~~~

**Signature**

`setOption(index, value)`

Sets the option at a particular index, or creates it if it doesn't exist

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |

| `value` | `boolean` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/custom-options/setoption`</small>


## getOption()

~~~ lua
local result = getOption(1)
~~~

**Signature**

`result = getOption(index)`

Gets the option at a particular index, or creates it if it doesn't exist

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/custom-options/getoption`</small>


## setOptionName()

~~~ lua
setOptionName(1, "value")
~~~

**Signature**

`setOptionName(index, content)`

Sets the name of the option at a particular index, or creates it if it doesn't exist

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |

| `content` | `string` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/custom-options/setoptionname`</small>


## setOptionDescription()

~~~ lua
setOptionDescription(1, "value")
~~~

**Signature**

`setOptionDescription(index, content)`

Sets the tooltip description of the option at a particular index, or creates it if it doesn't exist

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |

| `content` | `string` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/custom-options/setoptiondescription`</small>


## removeOption()

~~~ lua
removeOption(1)
~~~

**Signature**

`removeOption(index)`

Removes the slider option at the specified index

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/custom-options/removeoption`</small>


## setTextOption()

~~~ lua
setTextOption(1, "value")
~~~

**Signature**

`setTextOption(index, content)`

Sets the text of the TextOption at a particular index, or creates it if it doesn't exist

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |

| `content` | `string` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/custom-options/settextoption`</small>


## getTextOption()

~~~ lua
local result = getTextOption(1)
~~~

**Signature**

`result = getTextOption(index)`

Returns the text content of the TextOption at a particular index, or an empty string if it doesn't exist

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`string`
 — example: `"value"`



<small>Source key: `POST /lua/custom-options/gettextoption`</small>


## setTextOptionName()

~~~ lua
setTextOptionName(1, "value")
~~~

**Signature**

`setTextOptionName(index, content)`

Sets the name of the TextOption at a particular index, or creates it if it doesn't exist

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |

| `content` | `string` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/custom-options/settextoptionname`</small>


## setTextOptionDescription()

~~~ lua
setTextOptionDescription(1, "value")
~~~

**Signature**

`setTextOptionDescription(index, content)`

Sets the tooltip description of the TextOption at a particular index, or creates it if it doesn't exist

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |

| `content` | `string` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/custom-options/settextoptiondescription`</small>


## removeTextOption()

~~~ lua
removeTextOption(1)
~~~

**Signature**

`removeTextOption(index)`

Removes the text option at the specified index

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `index` | `integer` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/custom-options/removetextoption`</small>


# File APIs


## writeToFile()

~~~ lua
writeToFile("logs/script.txt", "value", true)
~~~

**Signature**

`writeToFile(filename, text, false)`

Writes a string to file overwrite is an optional parameter, and will append the line(s) if absent

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `filename` | `string` | yes |  |

| `text` | `string` | yes |  |

| `false` | `boolean` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/file-apis/writetofile`</small>


## logToFile()

~~~ lua
logToFile("logs/script.txt", {}, true)
~~~

**Signature**

`logToFile(file, text, false)`

Writes a string, a number, or a table of strings and/or numbers to file overwrite is an optional parameter, and will append the line(s) if absent

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `file` | `string` | yes |  |

| `text` | `object` | yes | Any Lua value. |

| `false` | `boolean` | yes |  |


### Returns


`void`



<small>Source key: `POST /lua/file-apis/logtofile`</small>


## readLinesFromFile()

~~~ lua
local result = readLinesFromFile("logs/script.txt")
~~~

**Signature**

`result = readLinesFromFile(file)`

Returns a table of every line in file

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `file` | `string` | yes |  |


### Returns


`array<string>`
 — example: `[]`



<small>Source key: `POST /lua/file-apis/readlinesfromfile`</small>


## tradeGiveMoney()

~~~ lua
local result = tradeGiveMoney("value", 15)
~~~

**Signature**

`result = tradeGiveMoney(username, money)`

Used to trade money With Parameters Username and Money

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `username` | `string` | yes |  |

| `money` | `integer` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/file-apis/tradegivemoney`</small>


## tradeAcceptMoney()

~~~ lua
local result = tradeAcceptMoney()
~~~

**Signature**

`result = tradeAcceptMoney()`

Lua function `tradeAcceptMoney`.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/file-apis/tradeacceptmoney`</small>


# Chat


## closeChannel()

~~~ lua
local result = closeChannel("value")
~~~

**Signature**

`result = closeChannel(name)`

Close channel chat by name

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `name` | `string` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/chat/closechannel`</small>


# Notifications


## sendNotification()

~~~ lua
local ok = sendNotification("Shiny found")
~~~

**Signature**

`result = sendNotification(templateName)`

Send a configured notification template by name or id. Built-in variables such as `{player}`, `{map}`, `{x}`, `{y}`, `{account}`, `{server}`, `{bot}`, `{time}`, `{date}`, and `{datetime}` are filled automatically when available. The template's configured target controls whether it goes to personal Discord, the built-in PROCatchem Discord channel, Telegram, or all enabled channels. Returns `false` only when notifications are disabled or the template cannot be found; network delivery is asynchronous.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `templateName` | `string` | yes | Template display name or stable template id. |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/notifications/sendnotification`</small>


## sendNotificationWith()

~~~ lua
local ok = sendNotificationWith("Shiny found", { pokemon = "Gyarados", level = "30" })
~~~

**Signature**

`result = sendNotificationWith(templateName, values)`

Send a configured notification template and override/add template variables using a Lua table. Table keys should match template variables without braces. Per-call values override built-ins, runtime variables set by `setNotifyVar`, global variables, and template defaults.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `templateName` | `string` | yes | Template display name or stable template id. |

| `values` | `NotificationVariables` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/notifications/sendnotificationwith`</small>


## sendNotificationTo()

~~~ lua
local ok = sendNotificationTo("Bot stopped", "personal")
~~~

**Signature**

`result = sendNotificationTo(templateName, target)`

Send a configured notification template while overriding its delivery target for this one call. Accepted targets are `personal`, `discord`, `procatchem`, `telegram`, and `all`. `all` falls back to the template's configured target, which defaults to all enabled channels.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `templateName` | `string` | yes | Template display name or stable template id. |

| `target` | `NotificationTarget` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/notifications/sendnotificationto`</small>


## sendNotificationWithTo()

~~~ lua
local ok = sendNotificationWithTo("Shiny found", { pokemon = "Gyarados", level = "30" }, "procatchem")
~~~

**Signature**

`result = sendNotificationWithTo(templateName, values, target)`

Send a configured notification template, pass template variables, and override the delivery target for this one call. This is the most explicit notification helper for scripts that need to route different alerts to different channels.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `templateName` | `string` | yes | Template display name or stable template id. |

| `values` | `NotificationVariables` | yes |  |

| `target` | `NotificationTarget` | yes |  |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/notifications/sendnotificationwithto`</small>


## notify()

~~~ lua
local ok = notify("PROCatchem: script reached Cerulean City.")
~~~

**Signature**

`result = notify(message)`

Send a quick plain-text notification without using a configured template. Use this for simple alerts where you do not need title/body formatting or template variables. Returns immediately after queueing the asynchronous send.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `message` | `string` | yes | Plain text message to send. |


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/notifications/notify`</small>


## setNotifyVar()

~~~ lua
setNotifyVar("hunt", "Shiny Magikarp")
~~~

**Signature**

`setNotifyVar(name, value)`

Set a runtime notification variable. The variable can be used in any template as `{name}` until it is overwritten or cleared with `clearNotifyVars()`. Values are converted to strings.

### Parameters


| Name | Type | Required | Description |
|---|---|---:|---|

| `name` | `string` | yes | Variable name without braces. |

| `value` | `LuaValue` | yes |  |


### Returns


`null`



<small>Source key: `POST /lua/notifications/setnotifyvar`</small>


## clearNotifyVars()

~~~ lua
clearNotifyVars()
~~~

**Signature**

`clearNotifyVars()`

Clear all runtime notification variables previously set with `setNotifyVar`. Built-in variables and configured template/default variables are not removed.


### Returns


`null`



<small>Source key: `POST /lua/notifications/clearnotifyvars`</small>


# Legacy special actions


## useSurf()

~~~ lua
local result = useSurf()
~~~

**Signature**

`result = useSurf()`

Start surfing from the current position. If `setWaterMount()` configured a water mount, the tool uses that mount item; otherwise it sends the normal `/surf` action. Pathfinding also calls this automatically when a route transitions from ground to water.


### Returns


`boolean`
 — example: `true`



<small>Source key: `POST /lua/legacy-special-actions/usesurf`</small>
