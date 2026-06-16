name = "Basic PROCatchem Script"
author = "PROCatchem Community"
description = "Minimal example using the Lua Script API."

function onStart()
    log("Script started on " .. getMapName())
end

function onPathAction()
    if isPCOpen() then
        return
    end

    if getMapName() == "Viridian City" then
        moveToGrass()
    else
        moveToMap("Viridian City")
    end
end

function onBattleAction()
    if isWildBattle() and not isAlreadyCaught() then
        weakAttack()
    else
        attack()
    end
end
