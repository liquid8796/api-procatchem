name = "Opponent Gender and Dismount Example"
author = "PROCatchem"
description = "Shows getOpponentGender() in battle and disMount() on the map."

function onPathAction()
    if isMounted() and not isSurfing() then
        if disMount() then
            log("Ground mount disabled and dismount requested.")
        end
        return
    end

    moveToGrass()
end

function onBattleAction()
    local gender = getOpponentGender()

    if gender == "M" then
        log("Opponent gender: male")
    elseif gender == "F" then
        log("Opponent gender: female")
    else
        log("Opponent gender: genderless or unknown")
    end

    attack()
end
