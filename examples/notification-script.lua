name = "Notification Example"
author = "PROCatchem Community"
description = "Example showing how to send Discord/Telegram notifications from Lua."

function onStart()
    setNotifyVar("script", name)
    notify("PROCatchem notification script started on " .. getMapName())
end

function onBattleAction()
    if isWildBattle() and isOpponentShiny() then
        sendNotificationWithTo("Shiny found", {
            pokemon = getOpponentName(),
            level = tostring(getOpponentLevel()),
            map = getMapName()
        }, "procatchem")
        return
    end

    attack()
end

function onStop()
    sendNotificationTo("Bot stopped", "personal")
    clearNotifyVars()
end
