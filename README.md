# Candle App Store

An app store addon for the Candle Controller. It is a core component of the Candle smart home controller. It is one of the first app stores ever to let users filter by privacy protection level.

https://www.candlesmarthome.com

![Candle store screenshot](screenshot.jpg?raw=true "Candle store screenshot")

## Privacy levels

Addons can have 5 privacy levels. Addons are rated manually by Candle, or by the community through their reviews.

0. unknown
1 to 2: bad
2 to 3: poor
3 to 4: ok
4 and above: great


Factors that are taken into account:
- Data minimisation. Is data stored, and if so, are there options or built-in efforts to limit this?
- Privacy design. Are there features to improve privacy? Are there mitigations for corporate surveillance and/or coveillance?
- Explanation. Does the addon explain what data is collected? 
- Legal protection. Is there a privacy policy? Are there clear data processing agreements?
- Internet connection. Does the addon connect to the internet? Are there attempts to limit this frequency (e.g. with caching) so that there is less behavioural data?
- Third parties. If connections are made to the internet.. to whom is the connection made? Is the server in Europe or elsewhere? Are "free" services used? What's their businessmodel?
- Is data stored in the cloud? If so, for how long? And under which jurisdiction is it stored?
- Anonimisation. If the addon request an account, how much user information is needed? For example, the Web Interface addon has a psueodonymous account system.

This list is likely not complete, but should give an indication.


## Expertise levels

Some addons are easy to use by beginners, while others may require more technical skill.

- Beginner friendly. The addon works great out of the box. Having an attractive and easy to use UI what follows the existing design conventions is a plus (assuming a UI extension makes sense). The addon settings are easy to understand, and if something goes wrong or is missing (like a usb stick), the user is clearly informed. It integrates well with voice control.
- Tinkerer. The addons requires some technical knowledge to set up, but it's not too difficult to figure out. For example, an API code might need to be added to the settings before it will work. How easy is it for someone to figure this out? Does the addon help people take these steps, through explanation in the settings or github?
- Expert. You understand quite a bit about how smart homes work, and you know what a lot of the jargon is, and who the players are. 
- Hardcore. You have no problem using the linux command line, and can even troubleshoot a broken system.
- Beta tester. You are involved in the Candle or web things ecosystem. Perhaps you develop your own addons.



## Getting your addon into the Candle store

If your addon is already part of the Webthings addons list, then it should automatically show up in this app store too. This may take a while because there is a manual step, so you can create an issue to speed up this process. New addons will initially only be visible if the "beta testers" filter is enabled. If there are a positive reviews for your addon it will become available for lower expertise levels.

If your addon is not being accepted to the Webthings Gateway addons list, then you can ask for inclusion in the Candle store directly:
https://github.com/createcandle/addons-list




## Manual installation

The easiest way is to install the SeaShell addon, and then execute this command in it:

`git clone --depth=1 https://github.com/createcandle/candleappstore.git /home/pi/.webthings/addons/candleappstore`

Then reboot your controller and it will show up in the installed addons list, where you can enable it.

