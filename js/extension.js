(function() {
	class Candleappstore extends window.Extension {
	    constructor() {
	      	super('candleappstore');
			//console.log("Adding candleappstore addon to menu");
      		
            //console.log("API: ", window.API);
            
            
			this.addMenuEntry('Candle store');
	
            //const page = require('page');
            //console.log(page);
    
	      	this.content = '';
            
            this.kiosk = false;
            this.debug = false;
            this.developer = false;
            this.get_log_tail = false;
            this.exhibit_mode = false;
            this.interval = null;
            this.current_page = "installed";
            this.busy_polling = false;
            
            this.apps_overview = {};
            this.installed = []; // has data about folders in the addons folder. Comes from app store addon, and is then updated if addons are installed or uninstalled.
            this.cloud_app_data = []; // list of available apps, comes from the web via app store addon. #TODO: buffer this data locally to protect privacy
            this.api_addons_data = []; // has data about the settings of all addons, comes from gateway API.
            this.addons_to_update = []; // if adddons with new versions are spotted, their ID's will be added to this list.
            this.addons_being_installed = []; // contains names of addons in process of being installed, so that the install button can be hidden
            this.addon_dirs = []; // reflects actual directories on the disk
            this.extensions = []; // holds all the data about installed addons data that extend the UI (css and js files)
            this.extensions_list = [];
            this.selector = "";
            this.username = "";
            this.permissions = {};
            this.received_cloud_data = false;
            this.updating_all = false;
            
			fetch(`/extensions/${this.id}/views/content.html`)
	        .then((res) => res.text())
	        .then((text) => {
	         	this.content = text;
	  		 	if( document.location.href.endsWith("extensions/candleappstore") ){
					//console.log(document.location.href);
	  		  		this.show();
	  		  	}
	        })
	        .catch((e) => console.error('Failed to fetch content:', e));
            
            
            if(document.getElementById('virtualKeyboardChromeExtension') != null){
                document.body.classList.add('kiosk');
                this.kiosk = true;
            }
            
            
            //document.getElementById('installed-addons-list').style.display = 'none';
            document.getElementById('addon-main-settings').innerHTML += '<div id="extension-candleappstore-addons-page-redirect"><a href="/extensions/candleappstore" class="text-button">Return to Candle app store</a></div>';
            
            
            //console.log("local storage JWT: ", localStorage.getItem('jwt'));
                        
            
            document.getElementById('add-adapters-hint-anchor').href = '/candleappstore';
            
            //
            // PRE-INIT
            //
			window.API.postJson(
				`/extensions/candleappstore/api/ajax`,
				{'action':'init'}
			)
            .then((body) => {
                
                // Debug?
                if(typeof body.debug != 'undefined'){
                    this.debug = body.debug;
                }
                
                if(this.debug){
                    console.log("App Store INIT response: ", body);
                }
                
                // Received data from Candle server?
				if( body['state'] != true ){
					//pre.innerText = body['message'];
				}
                else{
                    this.app_store_url = body['app_store_url'];
                    this.installed = body['installed'];
                    this.permissions = body['permissions'];
                    //this.generate_installed( body['installed'] );
                    //console.log("installed according to python: ", this.installed);
                    
                }
                
                // Show developer options
                if(typeof body.developer != 'undefined'){
                    if(body.developer){
                        if(document.getElementById('authorization-settings-link') != null){
                            document.getElementById('authorization-settings-link').style.display = 'block';
                            document.getElementById('experiment-settings-link').style.display = 'block';
                            document.getElementById('developer-settings-link').style.display = 'block';
                        }
                        document.body.classList.add('developer');
                        this.get_log_tail = true;
                    }
                    if(document.body.classList.contains('developer')){
                        this.developer = true;
                        console.log("early init: developer = true");
                    }
                }
                
                if(typeof body.exhibit_mode != 'undefined'){
                    if(body.exhibit_mode){
                        this.exhibit_mode = true;
                    }
                }
                
                // Make sure menu button is always visible. Can be hidden if the user returns from a complex addon settings page using their browser's back button.
                //document.getElementById('menu-button').classList.remove('hidden');
                
    
			})
            .catch((e) => {
				console.log("candleappstore: error in init: ", e);
			});
            
	    }





        // Compares the data from the internal API with the cloud data
        check_for_updates(){
            //console.log("in check_for_updates");
            
            if(this.cloud_app_data.length > 0 && this.api_addons_data.length > 0){
                //console.log("- both API and Cloud data had length");
                
                this.addons_to_update = []; // Holds only addon_id strings
                this.addons_to_update_full = []; // holds complete dictionaries
                
                for(let i = 0; i < this.api_addons_data.length; i++){
                    //console.log("generating. item data: ", data[i]);
                    //console.log( this.api_addons_data[i].id );
                    var addon_id = "error";

                    // Get the data about this addon from the gateway API as well
                    //var api_data = null;
                    try{
                        
                        for(let u= 0; u < this.cloud_app_data.length; u++){
                            if( this.cloud_app_data[u]['addon_id'] == this.api_addons_data[i].id ){
                                
                                const api_version_parts = this.api_addons_data[i]['version'].split(".");
                                
                                if(this.api_addons_data[i].id == 'candleappstore'){
                                    //console.log("\n\nFound in cloud data");
                                
                                    //console.log(this.api_addons_data[i]);
                                    //console.log(this.cloud_app_data[u]);
                                    //console.log("api_version_parts: ", api_version_parts);
                                    
                                    //console.log("mayor: ", parseInt(api_version_parts[0]) , parseInt(this.cloud_app_data[u]['mayor_version']));
                                    //console.log("meso: ",  parseInt(api_version_parts[1]) , parseInt(this.cloud_app_data[u]['meso_version']));
                                    //console.log("minor: ", parseInt(api_version_parts[2]) , parseInt(this.cloud_app_data[u]['minor_version']));
                                }
                                
                                
                                const local_version_int = (parseInt(api_version_parts[0]) * 1000000) + (parseInt(api_version_parts[1]) * 1000) + parseInt(api_version_parts[2]);
                                const cloud_version_int = (parseInt(this.cloud_app_data[u]['mayor_version']) * 1000000) + (parseInt(this.cloud_app_data[u]['meso_version']) * 1000) + parseInt(this.cloud_app_data[u]['minor_version']);
                                
                                //console.log("local and cloud version ints : ", local_version_int, cloud_version_int);
                                
                                if( cloud_version_int > local_version_int){
                                    //console.log("an update is available for: " + this.api_addons_data[i].id);
                                    this.addons_to_update.push(this.api_addons_data[i].id);
                                    this.addons_to_update_full.push({'addon_id':this.api_addons_data[i].id,'url':this.api_addons_data[i].url})
                                }
                                
                                
                                /*
                                
                                var update_available = false;
                                
                                if( parseInt(api_version_parts[0]) < parseInt(this.cloud_app_data[u]['mayor_version'])){
                                    update_available = true;
                                }
                                else if( parseInt(api_version_parts[1]) < parseInt(this.cloud_app_data[u]['meso_version'])){
                                    update_available = true;
                                }
                                else if( parseInt(api_version_parts[2]) < parseInt(this.cloud_app_data[u]['minor_version'])){
                                    update_available = true;
                                }
                                
                                if(update_available){
                               //console.log("an update is available for: " + this.api_addons_data[i].id);
                                    this.addons_to_update.push(this.api_addons_data[i].id);
                                }
                                */
                                
                                
                                //api_data = this.api_addons_data[u];
                                //addon_id = data[i].addon_id;
                                //console.log("found api_data");
                                //console.log(api_data);
                                //break;
                            }
                        }
                        
                    }
                    catch(e){
                        console.log("error looping over cloud data for find updates: ", e);
                    }
                
                }
                
                if(this.addons_to_update.length > 0){
                    //console.log("addons with updates: ", this.addons_to_update);
                    document.getElementById('extension-candleappstore-view').classList.add('extension-candleappstore-updates-available');
                    //document.getElementById('extension-candleappstore-update-all-button').style.display = 'block';
                    this.generate_overview('updates');
                }
                else{
                    //console.log('no updates were available');
                    document.getElementById('extension-candleappstore-view').classList.remove('extension-candleappstore-updates-available');
                    document.getElementById('extension-candleappstore-updates-list').innerText = 'All your addons are up to date';
                }
                
            }
            else{
                //console.log('- check for updates: one of the two data sources is empty');
            }
            
            
        }

        
        // Returns a single item from the large cloud data list of addons. It does not have details.
        get_cloud_addon_data(desired_addon_id){
            //console.log("in get_cloud_addon_data. this.cloud_app_data: ", this.cloud_app_data);
            //console.log("looking for: ", desired_addon_id);
            //console.log("this.cloud_app_data.length: ",  this.cloud_app_data.length );
            //console.log("keys length: ",  Object.keys(this.cloud_app_data).length );
            
            if(this.cloud_app_data.length > 0){
                
                //const cloud_keys = Object.keys(this.cloud_app_data);
                
                for(let i = 0; i < this.cloud_app_data.length; i++){
                    //console.log(i, this.cloud_app_data[i]);
                    const item = this.cloud_app_data[i];
                    //console.log(item.addon_id);
                    if(item.addon_id == desired_addon_id){
                        return item;
                    }
                    //console.log()
                    //console.log("generating. item data: ", data[i]);
                    /*
                    //console.log( this.api_cloud_app_data[cloud_keys[i]].addon_id );
                    
                    if(this.api_cloud_app_data[cloud_keys[i]].addon_id = desired_addon_id){
                        //console.log("- returning: ", this.api_cloud_app_data[cloud_keys[i]]);
                        return this.api_cloud_app_data[cloud_keys[i]];
                    }
                    */
                }
            }
            else{
                return null;
            }
        }




		hide() {
			//console.log("candleappstore hide called");
            
			try{
				clearInterval(this.interval);
                this.interval == null
				//console.log("interval cleared");
			}
			catch(e){
				//console.log("no interval to clear? " + e);
			}
            
		}
		



	    show() {
			//console.log("candleappstore show called");
			//console.log("this.content:");
			//console.log(this.content);
            //console.log("Window: ");
            //console.log(window);
            //console.log("API: ");
            //console.log(window.API);
            //console.log(window.API.getInstalledAddons());
            //console.log(window.API.getAddonConfig("airport"));
            //console.log(window.API.uninstallAddon);
            //window.API.uninstallAddon("bla");
            
            const main_view = document.getElementById('extension-candleappstore-view');


            // get a z-index above the main menu button while overlay with back button is active
            main_view.style.zIndex = 'auto';
            
            
			try{
				clearInterval(this.interval);
                this.interval == null
			}
			catch(e){
				//console.log("no interval to clear?: " + e);
			}
            
			
            /*
            //function loadJSON(callback) {   
            function loadJSON() {   

               var xobj = new XMLHttpRequest();
                   xobj.overrideMimeType("application/json");
               xobj.open('GET', 'https://www.candlesmarthome.com/appstore/get_rating.php?addon_id=airport', true); // Replace 'appDataServices' with the path to your file
               xobj.onreadystatechange = function () {
                     if (xobj.readyState == 4 && xobj.status == "200") {
                       // Required use of an anonymous callback as .open will NOT return a value but simply returns undefined in asynchronous mode
                    //console.log(xobj.responseText);
                         //callback(xobj.responseText);
                     }
               };
               xobj.send(null);  
            }
            //console.log("attempting to load json");
            loadJSON();
			*/
            
			if(this.content == ''){
				return;
			}
			else{
				//document.getElementById('extension-candleappstore-view')#extension-candleappstore-view
				main_view.innerHTML = this.content;
			}
			
            
            // TABS
            
            var all_tabs = document.querySelectorAll('.extension-candleappstore-tab');
            var all_tab_buttons = document.querySelectorAll('.extension-candleappstore-main-tab-button');
        
            for(var i=0; i< all_tab_buttons.length;i++){
                all_tab_buttons[i].addEventListener('click', (event) => {
        			//console.log(event);
                    var desired_tab = event.target.innerText.toLowerCase().replace(/\s/g , "-");
                    if(desired_tab == '?'){desired_tab = 'help';}
                    //console.log("desired tab: " + desired_tab);
                    
                    this.current_page = desired_tab;
                    
                    for(var j=0; j<all_tabs.length;j++){
                        all_tabs[j].classList.add('extension-candleappstore-hidden');
                        all_tab_buttons[j].classList.remove('extension-candleappstore-tab-selected');
                    }
                    document.querySelector('#extension-candleappstore-tab-button-' + desired_tab).classList.add('extension-candleappstore-tab-selected'); // show tab
                    document.querySelector('#extension-candleappstore-tab-' + desired_tab).classList.remove('extension-candleappstore-hidden'); // show tab
                });
            };
            
            

            
            window.API.getExtensions()
            .then((result) => { 
				//console.log("getExtensions result: ");
				//console.log(result);
                this.extensions = result;
                this.extensions_list = Object.keys(result);
			}).catch((e) => {
				console.log("getExtensions catch (error?): ", e);
                //console.log(e);
			});
            
			
			const list = document.getElementById('extension-candleappstore-list');
			//const pre = document.getElementById('extension-candleappstore-response-data');
            const installed_list = document.getElementById('extension-candleappstore-installedlist');
            const selected = document.getElementById('extension-candleappstore-selected');
            const settings = document.getElementById('extension-candleappstore-settings');
            const selected_close_button = document.getElementById('extension-candleappstore-selected-close-container');
            const settings_close_button = document.getElementById('extension-candleappstore-settings-close-container');
            const auth_close_button = document.getElementById('extension-candleappstore-auth-close-container');
            
            //console.log("installedlist:");
            //console.log(installedlist);
            
            
            
			selected_close_button.addEventListener('click', (event) => {
                //console.log("Selected app close button clicked");
                selected.style.display = 'none';
                document.getElementById('extension-candleappstore-installation-failed').style.display = 'none';
                document.getElementById('extension-candleappstore-view').style.zIndex = 'auto';
			});
            
			settings_close_button.addEventListener('click', (event) => {
                //console.log("Settings close button clicked");
                settings.style.display = 'none';
                document.getElementById('extension-candleappstore-view').style.zIndex = 'auto';
			});
            
			auth_close_button.addEventListener('click', (event) => {
                //console.log("Auth close button clicked");
                auth.style.display = 'none';
                document.getElementById('extension-candleappstore-view').style.zIndex = 'auto';
                document.getElementById('extension-candleappstore-review-response').innerText = "";
			});
            
            
            const auth = document.getElementById('extension-candleappstore-auth');
            
            const login_form = document.getElementById('extension-candleappstore-auth-login-form');
            const signup_form = document.getElementById('extension-candleappstore-auth-signup-form');
            const verify_form = document.getElementById('extension-candleappstore-auth-verify-form');
            
            
            const review_container = document.getElementById('extension-candleappstore-review-container');
            
            const auth_response = document.getElementById('extension-candleappstore-auth-response');
            const review_response = document.getElementById("extension-candleappstore-review-response");
            
            const username = document.getElementById('extension-candleappstore-username');
            const check_login_button = document.getElementById('extension-candleappstore-check-login-button');
            const logout_container = document.getElementById('extension-candleappstore-logout');
            
            const login_button = document.getElementById('extension-candleappstore-login-button');
            const forgot_button = document.getElementById('extension-candleappstore-forgot-button');
            const signup_button = document.getElementById('extension-candleappstore-signup-button');
            const verify_button = document.getElementById('extension-candleappstore-verify-button');
            const logout_button = document.getElementById('extension-candleappstore-logout-button');
            const review_save_button = document.getElementById('extension-candleappstore-review-save-button');
            const review_cancel_button = document.getElementById('extension-candleappstore-review-cancel-button');
            
            const review_rating_select = document.getElementById('extension-candleappstore-rating-select');
            const review_risk_select = document.getElementById('extension-candleappstore-risk-select');
            const review_text = document.getElementById('extension-candleappstore-review-text');
            const review_complete = document.getElementById('extension-candleappstore-review-complete');
            
            const show_signup_button = document.getElementById('extension-candleappstore-show-signup-button');
            const show_signup_button_container = document.getElementById('extension-candleappstore-show-signup-button-container');
            const signup_beta_checkbox = document.getElementById('extension-candleappstore-signup-beta');
            const github_username_container = document.getElementById('extension-candleappstore-github-username-container');
            const github_username = document.getElementById('extension-candleappstore-github-username');
            
            logout_button.addEventListener('click', (event) => {
                //console.log("logout button clicked");

                this.get_data('logout.php')
                .then(response => {
                    //console.log("LOGOUT RESPONSE!");
                    //console.log(response);
                    if(response.hasOwnProperty('ok')){
                        check_login_button.style.display = "inline-block";
                        logout_container.style.display = "none";
                    }
                    else if(response.hasOwnProperty('error')){
                        // user was already logged out.
                    }
                    username.innerText = "";
                    this.username = "";
                })
                .catch((e) => {
					//console.log("candleappstore: error while test");
				});
                
            });
        
            
            check_login_button.addEventListener('click', (event) => {
                //console.log("login button clicked");
                
                this.get_data('state.php')
                .then(response => {
                    //console.log("STATE RESPONSE!");
                    //console.log(response);
                    if(response.hasOwnProperty('ok')){
                        check_login_button.style.display = "none";
                        if(response.hasOwnProperty('username')){
                            username.innerText = response['username'];
                        }
                        logout_container.style.display = "inline-block";
                    }
                    else if(response.hasOwnProperty('action')){
                        if(response['action'] == "login"){
                            auth.style.display = 'block';
                            login_form.style.display = 'block';
                            signup_form.style.display = 'none';
                            verify_form.style.display = 'none';
                        }
                    }
                })
                .catch((e) => {
					console.log("candleappstore: error while testing logged in state: ", e);
					//pre.innerText = e.toString();
				});
            });
            
            
            
            login_button.addEventListener('click', (event) => {
                //console.log("login button clicked");
                
                const email = document.getElementById('extension-candleappstore-login-email').value;
                const password = document.getElementById('extension-candleappstore-login-password').value;
                
                if(email != "" && password != ""){
                    
                    const login_data = {
                        'email':email,
                        'password':password
                    }
                
                    // Get data for apps overview
                    this.get_data("login_json.php",login_data).then(response => {
                        //console.log("LOGIN RESPONSE!");
                        //console.log(response);
                        //console.log("typeof response = " + typeof response);
                        
                        if(response.hasOwnProperty('username')){
                            //console.log("username spotted");
                            this.username = response['username'];
                            document.getElementById("extension-candleappstore-username").innerText = response['username'];
                            //logout_button.style.display = 'block';
                            //login_form.style.display = 'none';
                        }
                        if(response.hasOwnProperty('ok')){
                            //console.log("ok in response");
                            auth_response.innerText = response['ok'];
                            logout_button.style.display = 'block';
                            login_form.style.display = 'none';
                        }
                        else if(response.hasOwnProperty('error')){   
                            auth_response.innerText = response['error'];
                        }
                        
                    });
                    
                }
                else{
                    alert("The passwords didn't match");
                }
                
			});
            
            
            forgot_button.addEventListener('click', (event) => {
                //console.log("forgot password button clicked");
                
                const email = document.getElementById('extension-candleappstore-login-email').value;
                
                if(email != ""){
                    
                    const login_data = {
                        'action':'forgot_password',
                        'email':email
                    }
                
                    // Get data for apps overview
                    this.get_data("ajax.php",login_data).then(response => {
                        //console.log("FORGOT RESPONSE:");
                        //console.log(response);
                        //console.log("typeof response = " + typeof response);
                        
                        if(response.hasOwnProperty('username')){
                            //console.log("username spotted");
                            this.username = response['username'];
                            //document.getElementById("extension-candleappstore-username").innerText = response['username'];
                            //logout_button.style.display = 'block';
                            //login_form.style.display = 'none';
                        }
                        if(response.hasOwnProperty('state')){
                            auth_response.innerText = response['message'];
                            if(response.state == 'ok'){
                                //console.log("ok in response");
                                
                                //logout_button.style.display = 'block';
                                //login_form.style.display = 'none';
                            }
                            
                        }
                        
                    });
                    
                }
                else{
                    alert("Please enter a valid email address");
                }
                
			});
            
            
            
            show_signup_button.addEventListener('click', (event) => {
                //console.log("show signup button clicked");
                login_form.style.display = 'none';
                signup_form.style.display = 'block';
                show_signup_button_container.style.display = 'none';
			});
            
            
            signup_beta_checkbox.addEventListener('change', (event) => {
                if(signup_beta_checkbox.checked){
                    github_username_container.style.display = 'block';
                }
                else{
                    github_username_container.style.display = 'none';
                }
                //console.log("signup_beta_checkbox.checked = " + signup_beta_checkbox.checked);
			});
            
            
            
            signup_button.addEventListener('click', (event) => {
                //console.log("signup button clicked");
                
                //const username = document.getElementById('extension-candleappstore-signup-username').value;
                const email = document.getElementById('extension-candleappstore-signup-email').value;
                const check = document.getElementById('extension-candleappstore-signup-check').value;
                const password = document.getElementById('extension-candleappstore-signup-password').value;
                const cpassword = document.getElementById('extension-candleappstore-signup-cpassword').value;
                const beta = signup_beta_checkbox.checked;
                const github_username = document.getElementById('extension-candleappstore-github-username').value;
                
                if(password == cpassword){
                    
                    const register_data = {
                        'action':'signup',
                        'check':check,
                        'email':email,
                        'password':password,
                        'beta':beta,
                        'github_username':github_username
                    }
                
                    // Get data for apps overview
                    this.get_data("ajax.php",register_data).then(response => {
                        //console.log("SIGNUP RESPONSE!");
                        //console.log(response);
                        //console.log("typeof response = " + typeof response);
                        if(response.hasOwnProperty('selector')){
                            this.selector = response['selector'];
                            signup_form.style.display = 'none';
                            verify_form.style.display = 'block';
                            
                            document.getElementById("extension-candleappstore-auth-intro").innerText = "";
                            
                        }
                        else if(response.hasOwnProperty('error')){   
                            auth_response.innerText = response['error'];
                        }
                        
                        if(response.hasOwnProperty('message')){
                            document.getElementById("extension-candleappstore-auth-intro").innerText = "";
                            document.getElementById('extension-candleappstore-auth-response').innerText = response.message;
                        }
                        
                    });
                    
                }
                else{
                    alert("The passwords didn't match");
                }
                
			});
            
            
            
            verify_button.addEventListener('click', (event) => {
                //console.log("verify button clicked");
                
                const code = document.getElementById('extension-candleappstore-verify-code').value;
                
                if(code != ""){
                    
                    const verify_data = {
                        'action':'verify',
                        'selector':this.selector,
                        'token':code
                    }
                    
                    
                    //this.get_data('verify_json.php?selector=' + this.selector + '&token=' + code ).then(response => {
                    this.get_data('ajax.php',verify_data).then(response => {
                        //console.log("VERIFY RESPONSE!");
                        //console.log(response);
                        //console.log("typeof response = " + typeof response);
                        if(response.hasOwnProperty('ok')){
                            verify_form.style.display = 'none';
                            login_form.style.display = 'block';
                            auth_response.innerText = response['ok'];
                            review_response.innerText = response['ok'];
                            auth.style.display = 'none';
                            alert("You are now logged in.")
                            document.getElementById('extension-candleappstore-review-response').innerText = "";
                            if(response.hasOwnProperty('username')){
                                //username.innerText = response['username'];
                                logout_container.style.display = 'inline-block';
                                login_button.style.display = 'none';
                            }
                        }
                        else if(response.hasOwnProperty('error')){
                            //console.log("Error verifying token");
                            auth_response.innerText = response['error'];
                        }
                    
                    });
                }
                else{
                    alert("Please enter the verification code first");
                }
                
			});
            
            
            
            // Update all button
            document.getElementById("extension-candleappstore-update-all-button").addEventListener('click', (event) => {
                //console.log("update all button clicked");
                this.update_all();
            });
            
            // Go to "add things" screen when addon was just installed
            //document.getElementById('extension-candleappstore-post-install-settings-add-things-button').addEventListener('click', AddThingScreen.show.bind(AddThingScreen));
            
            /*
            document.getElementById('extension-candleappstore-post-install-settings-add-things-button').addEventListener('click', (event) => {
			    const things_menu_button = document.getElementById("things-menu-item");
                if(things_menu_button != null){
                    things_menu_button.click();
                }
            });
            */
            
            //
            //   DEVELOPER TAB
            //
            
            // Developer - manual addon install button
            document.getElementById("extension-candleappstore-developer-addon-install-button").addEventListener('click', (event) => {
                console.log("manual addon install button clicked");
                
                if(this.exhibit_mode){
                    alert("Sorry, cannot install, exhibit mode is active");
                    return;
                }
                
                const addon_id = document.getElementById('extension-candleappstore-developer-addon-id').value;
                const url = document.getElementById('extension-candleappstore-developer-addon-url').value;
                const shasum = document.getElementById('extension-candleappstore-developer-addon-shasum').value;
                
                if(addon_id != "" && url != "" && shasum != ""){
                    
                    document.getElementById("extension-candleappstore-developer-busy-installing-app").style.display = 'block';
                    
                    window.API.installAddon( addon_id, url, shasum )
                    .then((result) => { 
        			
                        console.log("manual installation result:");
                        console.log(result);

                        //this.api_addons_data = []; // Remove the existing data about addons so that it will be re-requested from the window.API
                        
                        if(typeof result.enabled != "undefined"){
                            this.installed.push(addon_id);
                            console.log("addon installed succesfully: " + addon_id);
                            if(result.enabled == true){
                                console.log("- addon seems to be enabled");
                    
                                if(confirm("Addon installed OK. Refresh the page?")){
                                    document.getElementById('connectivity-scrim').classList.remove('hidden');
                                    setTimeout(function(){
                                        window.location.reload(true); // harsh, but no UI's without backends this way.
                                    }, 2000);
                                }
                                //this.generate_overview('shop');
                            }
                            else{
                                console.log("- Addon seems to be disabled?");
                                alert("Addon was installed, but is not enabled yet.");
                            }
                        }
                        else{
                            //console.log("installation failed, severely");
                            alert("Error: could not install. Check the javascript console for details.");
                        }
                        
                        document.getElementById("extension-candleappstore-developer-busy-installing-app").style.display = 'none';
                        
            
        			}).catch((e) => {
        				console.log("manual installation catch (error?): ", e);
                        //console.log(e);
        				//pre.innerText = e.toString();
                        //alert("Error: could not install. Could not connect to the controller.");
                        document.getElementById("extension-candleappstore-developer-busy-installing-app").style.display = 'none';
        			});
                }
                else{
                    alert("missing parameters");
                }
                
            });
            
            
            // Copy log line to clipboard
            document.getElementById("extension-candleappstore-developer-log-tail").addEventListener('click', (event) => {
                console.log("clicked on live log. event: ", event);
                
                var range = document.createRange();
                //range.selectNode(document.getElementById(element_id));
                range.selectNode(event.target);
                window.getSelection().removeAllRanges(); // clear current selection
                window.getSelection().addRange(range); // to select text
                document.execCommand("copy");
                window.getSelection().removeAllRanges();// to deselect
            
            });
            
            
            
            // SHOW REVIEW CONTAINER
            document.getElementById("extension-candleappstore-show-review-button").addEventListener('click', (event) => {
                //console.log("show review container button clicked");
                review_container.style.display = "block";
                document.getElementById("extension-candleappstore-review-tip").style.display = 'none';
                
                
                // Get data for apps overview
                this.get_data("login_json.php",{}).then(response => {
                    //console.log("LOGIN TEST RESPONSE!");
                    //console.log(response);
                    //console.log("typeof response = " + typeof response);
                    
                    if(response.hasOwnProperty('username')){
                        //console.log("username spotted");
                        this.username = response['username'];
                        //document.getElementById("extension-candleappstore-username").innerText = response['username'];
                        //logout_button.style.display = 'block';
                        //login_form.style.display = 'none';
                    }
                    
                    if(response.hasOwnProperty('ok')){
                        //console.log("ok in response");
                        //auth_response.innerText = response['ok'];
                        logout_button.style.display = 'block';
                        login_form.style.display = 'none';
                    }
                    else if(response.hasOwnProperty('error')){   
                        //console.log(response['error']);
                    }
                    
                });
                
                
            });
            
            
            // SAVE REVIEW
            
            review_save_button.addEventListener('click', (event) => {
                //console.log("review save button clicked");
                
                if(this.exhibit_mode){
                    console.log("reviews cannot be added while in exhibit mode");
                    alert("Sorry, reviews cannot be added in exhibit mode");
                    return;
                }
                
                review_response.innerHTML = "";
                auth_response.innerHTML = "";
                
                if(review_rating_select.value != -1){
                    
                    var parameters = {"rating":review_rating_select.value};
                    if(review_risk_select.value != -1){
                        parameters['risk'] = review_risk_select.value;
                    }
                    if(review_text.value.length > 3){
                        parameters['review'] = review_text.value;
                    }
                    else{
                        alert("Please provide an opinion");
                        return;
                    }
                    
                    parameters['mayor_version'] = document.getElementById("extension-candleappstore-selected-mayor_version").innerText;
                    parameters['meso_version'] = document.getElementById("extension-candleappstore-selected-meso_version").innerText;
                    parameters['minor_version'] = document.getElementById("extension-candleappstore-selected-minor_version").innerText;
                    
                    parameters['addon_id'] = selected.getAttribute('data-addon-id');
                    
                    //console.log(parameters);
                    const url = "rate.php";
                    //console.log(url);
                    
                    this.get_data(url, parameters)
                    .then(response => {
    					if(this.debug){
    					    console.log("ADD RATING response: ", response);
    					}
                        
                        if(response.hasOwnProperty('error')){
                            review_response.innerText = response['error'];
                        }
                        if(response.hasOwnProperty('ok')){
                            review_complete.innerText = response['ok'];
                            review_complete.style.display = 'block';
                            review_container.style.display = 'none';
                            review_text.value = '';
                            document.getElementById('extension-candleappstore-review-tip').style.display = "none";
                            document.getElementById('extension-candleappstore-reviews-list').innerHTML = "";
                            
                            //console.log("selected.getAttribute('data-addon-id'): ", selected.getAttribute('data-addon-id'));
                            //console.log("addon_id: ", addon_id);
                            //console.log("data: ", data);
                            //console.log("installed: ", installed);
                            
                            this.show_selected_app(selected.getAttribute('data-addon-id'));
                            
                        }
                        if(response.hasOwnProperty('action')){
                            //console.log("action spotted: " + response['action']);
                            if(response['action'] == "login"){
                                console.log("do action. login form: ", login_form);
                                login_form.style.display = "block";
                                signup_form.style.display = "none";
                                auth.style.display = "block";
                                document.getElementById("extension-candleappstore-auth-intro").innerText = "To add reviews you will need an account.";
                                login_form.style.display = "block;"
                            }
                        }
                    })
                    .catch((e) => {
    					console.log("candleappstore: connection error while saving rating: ", e);
    				});
                }
                else{
                    alert("please select a rating first");
                }
                
			});
            
            
            // CANCEL REVIEW
            review_cancel_button.addEventListener('click', (event) => {
                //console.log("review cancel button clicked");
                review_container.style.display = "none";
            });
            
            

            //
            //  SHOP FILTERS
            //
            
            document.getElementById('extension-candleappstore-filter-search-input').addEventListener('keyup', (event) => {
                console.log('search input changed');
                this.generate_overview('shop');
			});
            
            document.getElementById('extension-candleappstore-filter-search-input').addEventListener('blur', (event) => {
                console.log('search input blurred');
                this.generate_overview('shop');
			});
            
            
            
            document.getElementById('extension-candleappstore-filter-privacy-select').addEventListener('change', (event) => {
                //console.log('privacy filter changed');
                this.generate_overview('shop');
			});
            
            document.getElementById('extension-candleappstore-filter-reviews-select').addEventListener('change', (event) => {
                //console.log('reviews filter changed');
                this.generate_overview('shop');
			});
            
            document.getElementById('extension-candleappstore-filter-expert-select').addEventListener('change', (event) => {
                //console.log('expert filter changed');
                this.generate_overview('shop');
			});
            
            document.getElementById('extension-candleappstore-broken-addons-list').addEventListener('click', (event) => {
                //console.log('event.target', event.target);
                
                if(typeof event.target.dataset.addon_id != 'undefined'){
                    //console.log("addon_id: ", event.target.dataset.addon_id);
                    event.target.style.display = 'none';
                    this.manual_uninstall(event.target.dataset.addon_id);
                }
                
			});
            
            
            
            // Useful info about the system and what addons it may be able to install
            /*
            window.API.getAddonsInfo()
            .then((result) => { 
				//console.log("get addons info result: ");
				//console.log(result);
			}).catch((e) => {
				//console.log("get addons info catch (error?)");
                //console.log(e);
				//pre.innerText = e.toString();
			});
            */
            
            
            

            
            
            
            
			/*
			document.getElementById('extension-candleappstore-refresh-button').addEventListener('click', (event) => {
				//console.log("refresh button clicked");
				//this.get_latest();
                
           //console.log("GRABBING JSON VIA ADDON");
                //const dat = get_data("https://www.candlesmarthome.com/appstore/get_rating.php?addon_id=airport");
                //console.log(dat);
        
        
                this.get_data("get_rating.php?addon_id=airport")
                .then(function(result) {
                  //return doSomethingElse(result);
                })
                //.then(function(newResult) {
                  //return doThirdThing(newResult);
                //})
                //.then(function(finalResult) {
                //  console.log('Got the final result: ' + finalResult);
                //})
                .catch(function(result) {
               //console.log("crash and burn");
                });
                
			});
            */
            
            

            
            
            
            
            //
            // INIT
            //
			window.API.postJson(
				`/extensions/candleappstore/api/ajax`,
				{'action':'init'}
			)
            .then((body) => {
                
                // Debug?
                if(typeof body.debug != 'undefined'){
                    this.debug = body.debug;
                }
                
                if(this.debug){
                    console.log("App Store INIT response: ", body);
                }
                
                // Received data from Candle server?
				if( body['state'] != true ){
					//pre.innerText = body['message'];
				}
                else{
                    this.app_store_url = body['app_store_url'];
                    this.installed = body['installed'];
                    this.permissions = body['permissions'];
                    //this.generate_installed( body['installed'] );
                    //console.log("installed according to python: ", this.installed);
                    
                    document.getElementById('extension-candleappstore-tab-button-shop').classList.remove('extension-candleappstore-hidden');
                    document.getElementById('extension-candleappstore-tab-button-updates').classList.remove('extension-candleappstore-hidden');
                }
                
                // Show developer options
                if(typeof body.developer != 'undefined'){
                    if(body.developer){
                        //document.getElementById('authorization-settings-link').style.display = 'block';
                        //document.getElementById('experiment-settings-link').style.display = 'block';
                        //document.getElementById('developer-settings-link').style.display = 'block';
                        document.body.classList.add('developer');
                    }
                    if(document.body.classList.contains('developer')){
                        this.developer = true;
                        console.log("developer = true");
                    }
                    
                }
                
                this.get_installed_addons_data()
                .then((result) => { 
                    //console.log("in get_installed_addons_data.then");
                    this.generate_overview('installed');
    			}).catch((e) => {
    			    console.log("Candle app store API init request error: ", e);
    			});
                
                //document.getElementById('menu-button').classList.remove('hidden');

			})
            .catch((e) => {
				console.log("candleappstore: error in init: ", e);
			});
            
            
            


			// TABS
			document.getElementById('extension-candleappstore-tab-button-installed').addEventListener('click', (event) => {
				//document.getElementById('extension-candleappstore-content').classList = ['extension-candleappstore-show-tab-satellites'];
                
                this.get_installed_addons_data()
                .then((result) => { 
                    //console.log("in get_installed_addons_data.then");
                    this.generate_overview('installed');
    			}).catch((e) => {
    				//console.log("get_installed_addons_data catch (error?):", e);
    			});
                
			});

			document.getElementById('extension-candleappstore-tab-button-shop').addEventListener('click', (event) => {
				//document.getElementById('extension-candleappstore-content').classList = ['extension-candleappstore-show-tab-timers'];
                
                if(this.received_cloud_data){
                    //console.log("already received data from the cloud earlier, so will use old data");
                    this.generate_overview('shop');
                }
                else{
                    //console.log("asking for data from the cloud");
                    // Get data for apps overview
                    this.get_data("get_apps.json").then(response => {
                        //console.log(" GET ALL APPS from CLOUD response:");
                        //console.log(response);
                
                        //const parsed = JSON.parse(response);
                        //console.log(parsed);
                        //this.cloud_app_data = parsed;
                        this.cloud_app_data = response;
                        this.received_cloud_data = true;
                        
                        this.generate_overview('shop'); 
                        this.check_for_updates();
                    })
                    .catch((e) => {
        				//console.log("candleappstore: could not get data for apps overview");
        				//pre.innerText = "Could not get latest apps data! " + e.toString();
        			});
                }
                
			});
            
			document.getElementById('extension-candleappstore-tab-button-updates').addEventListener('click', (event) => {
                
                if(this.received_cloud_data){
                    //console.log("already received data from the cloud earlier, so will use old data");
                    this.check_for_updates();
                }
                else{
                    //console.log("asking for data from the cloud");
                    // Get data for apps overview
                    this.get_data("get_apps.json").then(response => {
                        //console.log(" GET ALL APPS from CLOUD response:");
                        //console.log(response);
                
                        //const parsed = JSON.parse(response);
                        //console.log(parsed);
                        //this.cloud_app_data = parsed;
                        this.cloud_app_data = response;
                        this.received_cloud_data = true;
                        
                        this.check_for_updates();
                        
                    })
                    .catch((e) => {
        				console.log("candleappstore: error getting data for apps overview: ", e);
        				//pre.innerText = "Could not get latest apps data! " + e.toString();
        			});
                }
                
                
				//document.getElementById('extension-candleappstore-content').classList = ['extension-candleappstore-show-tab-tutorial'];
			});
            


            // Create interval
            if(this.interval == null){
    			this.interval = setInterval(() => {
                    
                    // The search field doesn't properly trigger from the virtual keyboard, so in this situation we check its contents every second
                    if(this.kiosk && this.current_page == 'shop'){
                        
                        this.generate_overview('shop');
                    }
    
                    // Create a live updating display of the internal log
                    if(this.get_log_tail && this.current_page == 'developer' && this.busy_polling == false){
                        this.busy_polling = true;
                        
                        try{
                            // /poll
            		        window.API.postJson(
            		          `/extensions/${this.id}/api/ajax`,
                                {'action':'poll'}

            		        ).then((body) => {
                                if(this.debug){
                                    console.log("candle store poll response: ", body);
                                }
                                if(typeof body.tail != 'undefined'){
                                    
                                    const filter_text = document.getElementById('extension-candleappstore-developer-log-tail-filter').value;
                                    
                                    var filtered_lines = [];
                                    if(filter_text.length > 1){
                                        for(var f = 0; f < body.tail.length; f++){
                                            if(body.tail[f].indexOf(filter_text) > -1){
                                                filtered_lines.push(body.tail[f]);
                                            }
                                        }
                                    }
                                    else{
                                        filtered_lines = body.tail;
                                    }
                                    
                                    var filtered_html = "";
                                    for(var f = 0; f < filtered_lines.length; f++){
                                        
                                        //filtered_html += '<span>' + filtered_lines[f] + '</span><br/>';
                                        
                                        var chunked_line = "";
                                        const line_array = filtered_lines[f].split(":");
                                        
                                        // add a new span tag after each colon
                                        for(var x = 0; x < line_array.length; x++){
                                            chunked_line += '<span>' + line_array[x];
                                            
                                            // Restore the colon
                                            if(x < line_array.length - 1){
                                                chunked_line += ':';
                                            }
                                        }
                                        
                                        
                                        // Add lots of closing spans
                                        for(var x = 0; x < line_array.length; x++){
                                            chunked_line += '</span>';
                                        }
                                        filtered_html += chunked_line + "<br/>";
                                        
                                        
                                    }
                                    
                                    document.getElementById('extension-candleappstore-developer-log-tail').innerHTML = filtered_html;
                                }
                                this.busy_polling = false;
        
            		        }).catch((e) => {
            		  			console.log("Error polling: ", e);
                                this.busy_polling = false;
            		        });
        
                        }
                        catch(e){
                            console.log("Error doing poll: ", e);
                            this.busy_polling = false;
                        }
                    }
                    
                    
	
    			}, 1000);
            }



		} // end of show()
		
	
    
    
    
    
    
    
        
        // Ask python to request some app server data
        get_data = (url, parameters) =>
        {
            const pre = document.getElementById('extension-candleappstore-response-data');
            //console.log(this);
            
            if(typeof parameters == 'undefined'){
                parameters = {};
            }
            
            return new Promise((myResolve, myReject) =>
            {
                //console.log("url = ", url);
                //console.log("parameters = ", parameters);
                
                //console.log(this);
                
    	        window.API.postJson(
    	            `/extensions/${this.id}/api/ajax`,
    			    {'action':'get_json','url':url,'parameters':parameters}

    	        ).then((body) => {
    				//console.log("Python API /get_json result:");
    				//console.log(body);
                
    				if(body['state'] == true){
                        //pre.innerText = body['message'];	
                        if(typeof body['body'] == "string"){
                            myResolve( JSON.parse(body['body']) );
                        }
                        else{
                            myResolve(body['body']);
                        }
                        
    				}
    				else{
                        //console.log('get_data: returned state was not "ok"');
                        myReject({});
    				}

    	        }).catch((e) => {
    	  			//console.log("Error getting timer items: " + e.toString());
    				//console.log("Error: " + e);
    				//pre.innerText = "getting json failed - connection error?";
    				//return {};
                    myReject({});
    	        });	
            
            });
        };
        
        // Get installed addons data from window.API
        get_installed_addons_data = () =>
        {
            const pre = document.getElementById('extension-candleappstore-response-data');
            //console.log(this);
            return new Promise((myResolve, myReject) =>
            {
                window.API.getInstalledAddons()
                .then((result) => { 
    				//console.log("get_installed_addons_data: result: ");
    				//console.log(result);
                    this.api_addons_data = result;
                    myResolve();
                    return result;
    			}).catch((e) => {
    				//console.log("get getInstalledAddons info catch (error?)");
                    //console.log(e);
    				//pre.innerText = e.toString();
                    myReject();
    			});
            });
        };
        
        
        remember_permission = (addon_id, permission, value) =>
        {
            const pre = document.getElementById('extension-candleappstore-response-data');
            //console.log(this);
            return new Promise((myResolve, myReject) =>
            {
    	        window.API.postJson(
    	            `/extensions/${this.id}/api/ajax`,
    			    {'action':'remember_permission','addon_id':addon_id,'permission': permission, 'value':value}

    	        ).then((body) => {
    				//console.log("Python API remember permission result:");
    				//console.log(body);
                
    				if(body['state'] == true){
                        //pre.innerText = body['message'];
                        this.permissions = body['permissions'];
                        
                        if(typeof body['body'] == "string"){
                            myResolve( JSON.parse(body['body']) );
                        }
                        else{
                            myResolve(body['body']);
                        }
                        
    				}
    				else{
                        myReject({});
    				}

    	        }).catch((e) => {
    	  			//console.log("Error getting timer items: " + e.toString());
    				//console.log("Error: " + e);
    				//pre.innerText = "remembering permission failed - connection error?";
    				//return {};
                    myReject({});
    	        });	
            });
        }
        
        
        
        
        
        
        
        
        
        
        //
        //  UPDATE ALL
        //
        
        update_all(){
            if(this.updating_all == false){
                this.updating_all = true;
                document.body.classList.add("extension-candleappstore-busy-updating-all");
                document.getElementById('extension-candleappstore-update-all-button').style.display = 'none'; // superfluous, button already hides itself.
                this.update_loop();
            }
        }
    
    
        update_loop(){
            //console.log("in update_loop");
            if(this.addons_to_update.length > 0 ){
                
                const random_addon_id_index = Math.floor(Math.random() * this.addons_to_update.length);
                //console.log('random_addon_id_index: ', random_addon_id_index);
                const cloud_addon_data = this.get_cloud_addon_data(this.addons_to_update[random_addon_id_index]);
                if(cloud_addon_data != null){
                    window.API.updateAddon( cloud_addon_data.addon_id, cloud_addon_data.download_url, cloud_addon_data.checksum )
                    .then((result) => {
                        console.log('update_all: addon updated succesfully: ', cloud_addon_data.addon_id);
                        this.addons_to_update = this.addons_to_update.filter(e => e !== cloud_addon_data.addon_id);
                
                        if(this.addons_to_update.length == 0 ){
                            document.getElementById('extension-candleappstore-tab-button-updates').classList.remove('extension-candleappstore-tab-button-updates-available');
                            document.getElementById('extension-candleappstore-updates-list').innerHTML = "All your addons are up to date";
                            document.getElementById('extension-candleappstore-update-all-button').style.display = 'none';
                            document.body.classList.remove("extension-candleappstore-busy-updating-all");
                            this.updating_all = false;
                            
                            //if(confirm("Your addons have been updated. In order to see the latest versions you will need to reload this page. Would you like to do that now?")){
                                setTimeout(function(){
                                    window.location.reload(true); // harsh, but no UI's without backends this way.
                                }, 2500);
                            //}
                        }
                        else{
                            //console.log('on to the next addon.');
                            this.generate_overview('updates');
                            this.update_loop();
                        }
                
        			}).catch((e) => {
        				console.log("update addons loop catch (error?): ", e);
                        //console.log(e);
                        
        				//alert("Could not update. Connection error?");
                        document.getElementById('extension-candleappstore-updates-list').innerHTML = "A connection error occured while updating all addons";
                        document.body.classList.remove("extension-candleappstore-busy-updating-all");
                        document.getElementById('extension-candleappstore-update-all-button').style.display = 'block';
                        this.updating_all = false
                
        			});
                }
            }
        }
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
        //
        //  GENERATE OVERVIEW
        //
    
        // Create lists of addons in different flavours
        generate_overview(page){
            try{
                //const data = this.cloud_app_data; // this is data from the appstore server
                //const data = this.api_addons_data
                var data = [];
                
                document.getElementById('extension-candleappstore-view').style.zIndex = 'auto';
                
                if(typeof page == 'undefined'){
                    page = 'installed';
                }

                //console.log(".");
                //console.log(".");
                //console.log(".");
                //console.log("in generate_overview. page: ", page);
    			const pre = document.getElementById('extension-candleappstore-response-data');
    			const list = document.getElementById('extension-candleappstore-list');
    			//const original = document.getElementById('extension-candleappstore-original-item');
                const original_basic_item = document.getElementById('extension-candleappstore-original-item');
                var output_list_element = document.getElementById('extension-candleappstore-installedlist');
                const settings_container = document.getElementById('extension-candleappstore-settings');
                
                //console.log("extensions: ");
                //console.log(this.extensions_list);
            
                //var cloud_available = false;
                
                
                
                if(page == 'installed'){
                    data = this.api_addons_data;
                    //console.log("this.api_addons_data = ", this.api_addons_data);
                    data.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : -1) // sort alphabetically
                }
                else if(page == 'shop'){
                    data = this.cloud_app_data;
                    output_list_element = document.getElementById('extension-candleappstore-list');
                }
                else if(page == 'updates'){
                    data = this.api_addons_data;
                    data.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : -1) // sort alphabetically
                    output_list_element = document.getElementById('extension-candleappstore-updates-list');
                }
                
                var filtered_out_addons_count = 0; // how many addons are not shown because of the user's current filter settings
                
                
                // FILTER
                
                const minimal_privacy = document.getElementById('extension-candleappstore-filter-privacy-select').value;
                const minimal_reviews = document.getElementById('extension-candleappstore-filter-reviews-select').value;
                const maximum_expert = document.getElementById('extension-candleappstore-filter-expert-select').value;
                const search_text = document.getElementById('extension-candleappstore-filter-search-input').value;
                
                
                //
                //  UPDATE ADDONS
                //


                //console.log('this.installed (from python): ', this.installed);

                output_list_element.innerHTML = "";
                
                // Addons can be highlighted in a few levels. The higher the level, the earlier in the shop it should be shown
                // The shop loops over all data 5 times, each time appending items with a lower highlight level to the output
                // TODO: could offer the user a choice to filter by alphabet, by recommended (highlighted), or even filter by tag.
                var highest_highlight_level = 0;
                if(page == 'shop'){highest_highlight_level = 5;}
                
                var shown_as_installed_list = []; // used to check if all the dirs in the addons folder are represented in the output
                
                for(let current_highlight_level = highest_highlight_level; current_highlight_level >= 0; current_highlight_level--){
                    //console.log("x");
                    //console.log("current_highlight_level: ", current_highlight_level );
                    for(let i = 0; i < data.length; i++){
                        //console.log("generating. item data: ", data[i]);

                        var addon_id = "error";

                        // Get the data about this addon from the gateway API as well
                        var api_data = null;
                        try{
                            //if(cloud_available){
                            if(page == 'shop'){
                                //console.log('cloud available');
                                //console.log('Setting api_data to data from cloud. Cloud addon data: ', data[i]);
                                addon_id = data[i].addon_id;
                                api_data = data[i];
                            }
                            else{
                                api_data = data[i];     // do not change this order
                                addon_id = api_data.id; // sic
                                
                            }
                        }
                        catch(e){
                            console.log("Error getting api data for addon: ", e);
                        }
                    
                        
                        if(page == 'shop' || page == 'updates'){
                            
                            // Addons that are under heavy development are only available if developer mode is active
                            if(data[i]['stable'] == 0 && this.developer == false){
                                continue;
                            }
                        }
                        
                    
                        //console.log("final addon_id: ", addon_id);
                        //console.log("final item api_data: ", api_data);
                        //console.log("api_data.id = " + api_data.id);
                        //console.log("data[i].addon_id: " + data[i].addon_id);
                        
                        // Create clone
                        var clone = original_basic_item.cloneNode(true);
                        clone.removeAttribute('id');
                        clone.setAttribute('data-addon-id', addon_id);
                        if(page == 'shop'){
                            clone.style.background = "#" + this.string_to_color(addon_id);
                        }
                
                        // Check if this addon is a UI extension
                        var ui_extension = false
                        try{
                            if(this.extensions_list.indexOf(addon_id) != -1){
                                //console.log("-This addon is a UI extension");
                                ui_extension = true;
                                clone.setAttribute('data-extension', 1);
                            }
                        }
                        catch(e){
                            //console.log("Error getting extension value: ", e);
                        }
                    
                        
                
                        const keys = Object.keys(data[i]);
                        //console.log("keys: ", keys);
                    
    					keys.forEach((info, index) => {
                            //console.log(info);
                            
                    
                            if(info == 'name' || info == 'description'){
                                
                                var t = document.createElement('span');
                                var text = linkify(data[i][info], true); // removes links from descriptions, and turns them into actual links
                                
                                if(page == 'installed' && info == 'name'){
                                    text += '<span class="extension-candleappstore-basic-version">' + data[i]['version'] + '</span>';
                                }
                                
                                t.innerHTML = text;
                                
                                const selector_name = '.extension-candleappstore-basic-' + info;
                                var target_element = clone.querySelectorAll( selector_name )[0];
                                target_element.appendChild(t);
                            }
                            /*
                            else if( info == 'ip' ){
                                var a = document.createElement("a");
                                a.classList.add('extension-candleappstore-ip-link');
                                const url = window.location.href;
                                a.href = url.split("/")[0] + '//' + this.animals[mac][info]
                                var h = document.createTextNode(this.animals[mac][info]);
                                a.appendChild(h);
                        
                                const selector_name = '.extension-candleappstore-' + info;
                                var target_element = clone.querySelectorAll( selector_name )[0];
                                target_element.appendChild(a);
                            }
                            else if(info == 'protected'){
                                clone.querySelectorAll( '.extension-candleappstore-domains' )[0].innerHTML = '<p class="extension-candleappstore-privacy-warning">This device has connected to so many domains that it may be a laptop or mobile phone. To safeguard privacy its connection log will not be shown.</p>';
                                clone.querySelectorAll( '.extension-candleappstore-item-clear-button' )[0].remove();
                        
                            }
                            */
                
                        });
                
                
                        // open the app details page
    					clone.addEventListener('click', (event) => {
                      
                            //console.log("Clicked on item. event: ", event);
                    
                            event.stopImmediatePropagation();
                    
                            //target.dataset.domain
                            //document.getElementById('extension-candleappstore-review-tip').style.display = "block";
                            
                    
    						var target = event.currentTarget;
                            //console.log(target);
                            
                    
                            
    						//var parent3 = target.parentElement.parentElement.parentElement;
    						//parent3.classList.add("delete");
    						//var parent4 = parent3.parentElement;
    						//parent4.removeChild(parent3);
    	                    //console.log(target.dataset);
                            //console.log("addon_id = " + target.dataset['addon-id']);
                            //const url = "get_addons.php?addon_id=" + target.dataset.addon_id;
                            const data_addon_id = target.getAttribute('data-addon-id');
                            
                            this.show_selected_app(data_addon_id);

        				});
                        
                        var is_installed = true;
                
                        //console.log("is.. " + addon_id + " in the list of installed addons? ", this.installed);
                        
                        // The shop only shows addons that aren't installed
                        if(page == 'shop'){
                            //is_installed = true;
                            
                            if(this.installed.indexOf(addon_id) == -1 ){
                                is_installed = false;
                                
                                // not installed
                                //console.log("not in list of installed addons: ", addon_id);
                                clone.classList.add("extension-candleappstore-not-installed");
                                clone.setAttribute('data-installed', 0);
                    
                    
                        
                                // Check what the highlight score of this addon is. defaults to 0.
                                var highlight_score = 0;
                                if(typeof data[i]['highlight'] != 'undefined'){
                                    //console.log(" + + + highlight: ", data[i]['highlight']);
                                    highlight_score = parseInt(data[i]['highlight']);
                                }
                                /*
                                // wait, this doesn't work, since extension data is only available on installed addons.
                                //if(ui_extension){
                                if(highlighted > 0){
                                    //console.log("HIGHLIGHTING");
                                    //console.log("-This addon is a UI extension");
                                    list.insertBefore(clone, list.firstChild);
                                }else{
                                    //console.log("NOT HIGHLIGHTING");
                                    //console.log("-This addon is NOT a UI extension");
                                    list.appendChild(clone); 
                                }
                                */
                                

                                
                                
                                //console.log("data[i]['reviews_average']: ", data[i]['reviews_average']);
                                //console.log("data[i]['tags']: ", data[i]['tags']);
                                //console.log("privacy score: " + data[i]['privacy_score']);
                                //console.log("minimal score: " + minimal_privacy);
                                //if(minimal_privacy)

                                if(highlight_score == current_highlight_level){
                                    if(data[i]['privacy_score'] >= minimal_privacy && data[i]['nerdy'] <= maximum_expert && data[i]['reviews_average'] >= minimal_reviews){
                                        //console.log("HIGHLIGHTING addon:"  + addon_id + " , at level: ", current_highlight_level);
                                        //console.log("-This addon is a UI extension");
                                        //list.insertBefore(clone, list.firstChild);
                                    
                                        //console.log("search_text: ", search_text);
                                        if(search_text.length > 1){
                                    
                                           var tags_string = "";
                                           if( typeof data[i]['tags'] != 'undefined'){
                                               if( data[i]['tags'] != null ){
                                                   tags_string = data[i]['tags'].toLowerCase();
                                               }
                                           }
                                        
                                            //const addon_name = data[i]['name'].toLowerCase();
                                            if(data[i]['name'].toLowerCase().indexOf(search_text.toLowerCase()) == -1 && tags_string.indexOf(search_text.toLowerCase()) == -1){
                                                //console.log("skipping based on search text: ", data[i]['name']);
                                                filtered_out_addons_count++;
                                                continue;
                                            }
                                        }
                                    
                                        output_list_element.appendChild(clone); 
                                    }
                                    else{
                                        //console.log("skipping because of filter dropdowns");
                                        filtered_out_addons_count++;
                                    }
                                }
                                
                            }
                            else{
                                //console.log('in shop page, but this item was already installed, so skipping.');
                            }
                    
                        }
                        
                        
                        
                        
                        
                        
                        else{
                            // This parts only deals with addons that are installed.
                            if(current_highlight_level == 0){ // this makes it so that it only runs through this on the first iteration. Items in the shop are done in 5 levels instead.
                                //already installed, so add SETTINGS BUTTON (and then PLAY/PAUSE button)
                    
                    
                                //
                                //  Settings button
                                //
                    
                                var b = document.createElement("button");
                                b.classList.add('extension-candleappstore-selected-settings-button');
                                b.classList.add('extension-candleappstore-button');
                                b.classList.add('addon-settings-config');
                                b.classList.add('text-button');
                                b.setAttribute('data-addon-id', addon_id);
                                var t = document.createTextNode("Settings");
                                b.appendChild(t);
            					b.addEventListener('click', (event) => {
                                    //console.log("settings button clicked");
                                    //console.log(event);
                                    event.stopImmediatePropagation();
                                    //console.log("clicked on settings button for: ", addon_id );
                                    //console.log( event.target.getAttribute('data-addon-id') );

                        
                                    /*
            						window.API.postJson(
            							`/extensions/candleappstore/api/ajax`,
            							{'action':'get_manifest','addon_id': data[i]["addon_id"] }
            						).then((body) => { 
            							//console.log("clear item reaction: ");
            							//console.log(body);
            							if( body['state'] != true ){
            								//pre.innerText = body['message'];
            							}
                                        else{
                                            this.show_selected_app(JSON.parse(body['body']), target.getAttribute('data-installed') ); // data, and whether it is installed already
                                        }

            						}).catch((e) => {
            							//console.log("candleappstore: error in clear device handler");
            							//pre.innerText = e.toString();
            						});
                                    */
                        
                                    this.show_addon_config( event.target.getAttribute('data-addon-id') );                
                        
                        
                                });
                                //console.log("adding settings button");
                                //document.getElementById("extension-candleappstore-selected-options").appendChild(b);
                    
                                clone.setAttribute('data-installed', 1);
                                var target_element = clone.querySelectorAll( '.extension-candleappstore-basic-options' )[0];
                                if(page != 'updates'){
                                    target_element.appendChild(b);
                                }
                                
                                //installed_list.appendChild(clone);
                    
                    
                    
                    
                                //
                                // PLAY/PAUSE BUTTON
                                //
                                
                                b = null;
                                t = null;
                        
                        
                                //console.log("ui_extension is now: " + ui_extension);
                        
                                b = document.createElement("button");
                                b.classList.add('extension-candleappstore-selected-playpause-button');
                                b.classList.add('extension-candleappstore-button');
                        
                                b.setAttribute('data-extension', ui_extension);
                                b.setAttribute('data-addon_id', addon_id);
                                
                                if(api_data != null){
                                    if(api_data.enabled){
                                        b.classList.add('extension-candleappstore-pause-button');
                                        b.classList.add('addon-settings-disable');
                                        b.classList.add('text-button');
                            
                                        b.setAttribute('data-enabled', 1);
                                        t = document.createTextNode("Stop");
                                        b.appendChild(t);
                                    }
                                    else{
                                        b.classList.add('extension-candleappstore-play-button');
                                        b.classList.add('addon-settings-enable');
                                        b.classList.add('text-button');
                                
                                        b.setAttribute('data-enabled', 0);
                                        t = document.createTextNode("Start");
                                        b.appendChild(t);
                                    }
                                }
                                else{
                                    //console.log("WHOA, this installed addon had no api_data!?: " + addon_id);
                                    t = document.createTextNode("error");
                                    b.appendChild(t);
                                }
                    
            					b.addEventListener('click', (event) => {
                                    //console.log("playpause button clicked");
                                    //console.log(event);
                                    event.stopImmediatePropagation();
                                    //if (event.target.tagName.toLowerCase() === 'label') {
                                    //console.log( addon_id );
                                    
                                    
                                    
                                    const this_addon_id = event.target.getAttribute('data-addon_id')
                        
                                    var should_enable = null;
                                    //console.log(event.target.dataset.enabled);
                                    if(event.target.dataset.enabled == 1){
                                        //console.log("is enabled, so disabling now");
                                        should_enable = false;
                                    }
                                    else if(event.target.dataset.enabled == 0){
                                        //console.log("is DISabled, so enabling now");
                                        should_enable = true;
                                    }
                                    
                                    if(should_enable != null){
                                        if(this.developer == false){
                                            document.getElementById('connectivity-scrim').classList.remove('hidden');
                                        }
                                        //console.log("SWITCHING ADDON: " + this_addon_id + ", TO NEW STATE: " + should_enable);
                                        event.target.innerText = "....";
                                        window.API.setAddonSetting( this_addon_id, should_enable)
                                        .then((result) => {
                							//console.log("get addon play/pause result: ");
                							//console.log(result);
                                            
                                            if(typeof result.enabled != 'undefined'){
                                                //console.log('addon has been switched to: ', result.enabled);
                                                //console.log("event.target.dataset.extension: ", event.target.dataset.extension);
                                            }
                                            
                                            //console.log("ui_extension = " + ui_extension);
                                    
                                            //console.log("event.target.dataset.extension: " + event.target.dataset.extension );
                                    
                                            if(event.target.dataset.extension == "false"){
                                                //console.log("false string");
                                            }
                                            if(event.target.dataset.extension == false){
                                                //console.log("false as boolean");
                                            }
                                            
                                            //if(result['enabled']){
                                            if(this.developer == false){    
                                                setTimeout(function(){
                                                    window.location.reload(true); // harsh, but no UI's without backends this way.
                                                }, 2500);
                                            }
                                            //}
                                            
                                            
                                            /*
                                            if(result['enabled'] && event.target.dataset.extension == "true"){
                                                //console.log('Checking if the addon is already in the main menu');
                                                // Check if the addon is already in the main menu
                                                var spotted_in_menu = false;
                                                const addon_name_css = this_addon_id.replace(/_/g, "-");
                                                const menu_elements = document.querySelectorAll('#main-menu li a');
                                                menu_elements.forEach(element => {
                                                    const link_id = element.getAttribute('id');
                                                    //console.log('looking for: ' + addon_name_css + ', in: ' + link_id);
                                                    if(link_id.indexOf(addon_name_css) != -1){
                                                        //console.log('bingo, spotted in menu');
                                                        spotted_in_menu = true;
                                                    }
                                                });
                                                //console.log("spotted_in_menu: ", spotted_in_menu);
                                                //console.log("addon_name_css: ", addon_name_css);
                                                if(spotted_in_menu == false && addon_name_css != 'candle-theme'){
                                                    var really = confirm("The app will show up in the main menu after you reload this page. Would you like to reload now?");
                                                    if (really) {
                                                        window.location.reload();
                                                    }
                                                }
                                            }
                                            */
                                            
                                            
                                            //setTimeout(() =>{
                                                //this.generate_overview('installed');
                                            //},1000);
                                            
                                            this.get_installed_addons_data()
                                            .then((result) => { 
                                                //console.log("in get_installed_addons_data.then");
                                                this.generate_overview('installed');
                                                //return;
                                			}).catch((e) => {
                                				console.log("init: get_installed_addons_data catch (error?):", e);
                                			});
                                            
                                
                                
                                

                						}).catch((e) => {
                							//console.log("Error enabling/disabling addon: ", this_addon_id);
                                            //console.log(e);
                                            if(should_enable){
                                                event.target.innerText = "Start";
                                            }
                                            else{
                                                event.target.innerText = "Stop";
                                            }
                                            document.getElementById('connectivity-scrim').classList.add('hidden');
                							//pre.innerText = e.toString();
                						});
                                    }
                                    else{
                                        //document.getElementById('connectivity-scrim').classList.add('hidden');
                                        alert("There is something wrong with this app. You could try re-installing it.");
                                    }
                        
                        
                                    /*
                                    window.API.getAddonConfig( data[i]["addon_id"])
                                    .then((result) => { 
            							//console.log("get addon config result: ");
            							//console.log(result); 
                                        //console.log(data[i]);
                                        document.getElementById("extension-candleappstore-settings-title").innerText = data[i]["name"];
                                        this.show_addon_config(data[i]["addon_id"], result);

            						}).catch((e) => {
            							//console.log("get addon config catch (error?)");
                                       //console.log(e);
            							//pre.innerText = e.toString();
            						});
                                    */
                        
                        
                        
                                });
                                
                                //console.log("adding play/pause button");
                                //document.getElementById("extension-candleappstore-selected-options").appendChild(b);
                    
                                //clone.setAttribute('data-enabled', 1);
                                var target_element = clone.querySelectorAll( '.extension-candleappstore-basic-options' )[0];
                                if(page != 'updates' && addon_id != 'candleappstore'){
                                    target_element.appendChild(b);
                                }
                                
                                
                                
                                
                                
                                
                                //
                                //  Update button
                                //
                                
                                var b = document.createElement("button");
                                b.classList.add('extension-candleappstore-selected-update-button');
                                b.classList.add('extension-candleappstore-button');
                                //b.classList.add('addon-settings-config');
                                b.classList.add('text-button');
                                b.setAttribute('data-addon-id', addon_id);
                                var t = document.createTextNode("Update");
                                b.appendChild(t);
            					b.addEventListener('click', (event) => {
                                    //console.log("update button clicked");
                                    //console.log(event);
                                    event.stopImmediatePropagation();
                                    
                                    document.getElementById('extension-candleappstore-update-all-button').style.display = 'none';
                                    
                                    
                                    const this_addon_id = event.target.getAttribute('data-addon-id');
                                
                                    //console.log("clicked on update button for: ", addon_id );
                                    //console.log( event.target.getAttribute('data-addon-id') );
                                    // Show settings overlay
                                    //const updating_container = document.getElementById('extension-candleappstore-busy-updating');
                                    //updating_container.style.display = 'block';
                                    //updating_container.classList.add("extension-candleappstore-busy");
                                    //console.log("event.target.parentNode.parentNode.parentNode: ", event.target.parentNode.parentNode.parentNode);
                                    event.target.style.display = 'none';
                                    //console.log("event.path[2] : ", event.path[2] );
                                    //event.path[2].classList.add("extension-candleappstore-busy-updating");
                                
                                    event.target.parentNode.parentNode.parentNode.classList.add("extension-candleappstore-busy-updating");
                                    //extension-candleappstore-basic-options
                                
                                
                                    const cloud_addon_data = this.get_cloud_addon_data(this_addon_id);
                                    //console.log("get_cloud_addon_data returned: ", cloud_addon_data);
                                
                                    if(cloud_addon_data != null){
                                        //console.log("cloud_addon_data was not null");
                                    
                                        //console.log("dl url: ", cloud_addon_data.download_url);
                                        //console.log("checksum: ", cloud_addon_data.checksum);
                                        
                                        //console.log('this.addons_to_update: ', this.addons_to_update);
                                        
                                        window.API.updateAddon( cloud_addon_data.addon_id, cloud_addon_data.download_url, cloud_addon_data.checksum )
                                        .then((result) => { 
                							//console.log("addon update result: ");
                							//console.log(result); 
                            
                                            //document.getElementById("extension-candleappstore-settings-title").innerText = this.api_addons_data[ event.target.getAttribute('data-addon-id') ]['name'];
                                            event.target.parentNode.parentNode.parentNode.classList.add("extension-candleappstore-hidden");
                                            
                                            this.addons_to_update = this.addons_to_update.filter(e => e !== cloud_addon_data.addon_id);
                                            //console.log("new this.addons_to_update: ", this.addons_to_update);
                                            
                                            if(this.addons_to_update.length == 0 ){
                                                document.getElementById('extension-candleappstore-view').classList.remove('extension-candleappstore-updates-available');
                                                document.getElementById('extension-candleappstore-updates-list').innerHTML = "All your addons are up to date";
                                                //document.getElementById('extension-candleappstore-update-all-button').style.display = 'none';
                                            }
                                            else{
                                                document.getElementById('extension-candleappstore-update-all-button').style.display = 'block';
                                            }
                                            
                                            if(this.developer == false){    
                                                setTimeout(function(){
                                                    window.location.reload(true); // harsh, but no UI's without backends this way.
                                                }, 2000);
                                            }
                                            
                						}).catch((e) => {
                							console.log("update addon catch (error?): ", e);
                                            //console.log(e);
                                            event.target.parentNode.parentNode.parentNode.classList.remove("extension-candleappstore-busy-updating");
                                            document.getElementById('extension-candleappstore-update-all-button').style.display = 'block';
                							//alert("Could not update. Connection error?");
                                            
                						});
                                        
                                    }
                                    
                                    // (this.id, this.updateUrl, this.updateChecksum)
                                    /*
                                    window.API.updateAddon( event.target.getAttribute('data-addon-id') )
                                    .then((result) => { 
            							//console.log("get addon config result: ");
            							//console.log(result); 
                                
                                        //document.getElementById("extension-candleappstore-settings-title").innerText = this.api_addons_data[ event.target.getAttribute('data-addon-id') ]['name'];
                                        this.show_addon_config( event.target.getAttribute('data-addon-id') , result);

            						}).catch((e) => {
            							//console.log("get addon config catch (error?)");
                                        //console.log(e);
            							//pre.innerText = e.toString();
            						});
                                    */
                                    
                                    
                                    /*
            						window.API.postJson(
            							`/extensions/candleappstore/api/ajax`,
            							{'action':'get_manifest','addon_id': data[i]["addon_id"] }
            						).then((body) => { 
            							//console.log("clear item reaction: ");
            							//console.log(body);
            							if( body['state'] != true ){
            								//pre.innerText = body['message'];
            							}
                                        else{
                                            this.show_selected_app(JSON.parse(body['body']), target.getAttribute('data-installed') ); // data, and whether it is installed already
                                        }

            						}).catch((e) => {
            							//console.log("candleappstore: error in clear device handler");
            							//pre.innerText = e.toString();
            						});
                                    */
                        
                                    //this.get_installed_addons_data();
                                    /*
                                    //console.log("calling getAddonConfig for: " + addon_id);
                                    window.API.updateAddon( event.target.getAttribute('data-addon-id') )
                                    .then((result) => { 
            							//console.log("get addon config result: ");
            							//console.log(result); 
                                
                                        //document.getElementById("extension-candleappstore-settings-title").innerText = this.api_addons_data[ event.target.getAttribute('data-addon-id') ]['name'];
                                        this.show_addon_config( event.target.getAttribute('data-addon-id') , result);

            						}).catch((e) => {
            							//console.log("get addon config catch (error?)");
                                        //console.log(e);
            							//pre.innerText = e.toString();
            						});
                                    */
                        
                        
                        
                                });
                                //console.log("adding settings button");
                                //document.getElementById("extension-candleappstore-selected-options").appendChild(b);
                    
                                clone.setAttribute('data-installed', 1);
                                var target_element = clone.querySelectorAll( '.extension-candleappstore-basic-options' )[0];
                                if(page == 'updates'){
                                    if(this.addons_to_update.indexOf(addon_id) != -1){
                                        target_element.appendChild(b);
                                    }
                                }
                                
                                
                                //console.log("completed generating an installed element: ", clone);
                                //console.log("should append to output list now, which is: ", output_list_element);
                                if(page == 'installed'){
                                    output_list_element.appendChild(clone);
                                    shown_as_installed_list.push(addon_id);
                                }
                                else if(page == 'updates'){
                                    if(this.addons_to_update.indexOf(addon_id) != -1){
                                   //console.log(">>> Adding to update-available list: ", addon_id);
                                        output_list_element.appendChild(clone);
                                    }
                                    else{
                                        //console.log("No update available for: ", addon_id);
                                    }
                                }
                                
                            }
                            
                        } // end of else
                        
                        //console.log("\n\nNEXT!");
                        
                    } // end of for loop that loops over all addons
                    
                    
                } // of of for loop with 5 highlight levels
                
                if(page == 'shop'){
                    if(filtered_out_addons_count > 0){
                        //console.log("TOTAL FILTERED OUT: ", filtered_out_addons_count);
                        var filtered_out_tip_el = document.createElement("div");
                        filtered_out_tip_el.setAttribute('id', 'extension-candleappstore-filtered-out-tip');
                        var filtered_out_tip_text_el = document.createTextNode(filtered_out_addons_count + " addons are hidden by your current filter settings");
                        filtered_out_tip_el.appendChild(filtered_out_tip_text_el);
                        document.getElementById('extension-candleappstore-list').appendChild(filtered_out_tip_el);
                    }
                }
                
                // Check if all addon directories are output in the list
                var not_shown_addons_list = [];
                if(page == 'installed'){
                    //console.log("shown_as_installed_list: ", shown_as_installed_list);
                    //console.log("installed dirs: ", this.installed);
                    for(var p = 0; p < this.installed.length; p++){
                        
                        if(shown_as_installed_list.indexOf( this.installed[p] ) == -1){
                            console.log("Candle App store: warning, spotted an addon that was not shown in the installed list, but should have been: ", this.installed[p]);
                            not_shown_addons_list.push( this.installed[p] );
                        }
                    }
                }
                
                // Show list of broken addons
                if(not_shown_addons_list.length > 0){
                    console.log("not_shown_addons_list: ", not_shown_addons_list);
                    
                    document.getElementById('extension-candleappstore-broken-addons-list').innerHTML = "";
                    
                    for(var b = 0; b < not_shown_addons_list.length; b++){
                        var broken_item_el = document.createElement('div');
                        broken_item_el.appendChild(document.createTextNode("Delete " + not_shown_addons_list[b]));
                        broken_item_el.classList.add('extension-candleappstore-broken-addon-item');
                        broken_item_el.dataset.addon_id = not_shown_addons_list[b];
                        document.getElementById('extension-candleappstore-broken-addons-list').appendChild(broken_item_el);
                    }
                    document.getElementById('extension-candleappstore-broken-addons-container').style.display = 'block';
                    
                    
                    
                    /*
                    // Enabling this creates a loop
                    this.get_installed_addons_data()
                    .then((result) => { 
                        //console.log("in get_installed_addons_data.then");
                        this.generate_overview('installed');
                        
                        
                        for(var q = 0; q < not_shown_addons_list.length; q++){
                            console.log("NOW SHOWN ADDON, SHOULD GET FIXED: ", not_shown_addons_list[q]);
                    
                    
                            window.API.setAddonSetting( not_shown_addons_list[q], true)
                            .then((result) => {
        						console.log("enabled overlooked addon result: ");
        						console.log(result);
                        
                                if(typeof result.enabled != 'undefined'){
                                    console.log('addon has been switched to: ', result.enabled);
                                }

        					}).catch((e) => {
        						//console.log("Error enabling/disabling addon: ", this_addon_id);
                                console.log("Error switching on overlooked addon; ", e);
        					});
                    
                        }
                        
                        
                        
                        //return;
        			}).catch((e) => {
        				console.log("overlooked fix: get_installed_addons_data catch (error?):", e);
        			});
                    */
                    
                }
                else{
                    document.getElementById('extension-candleappstore-broken-addons-container').style.display = "none";
                }
                
                
                
            }
			catch (e) {
				// statements to handle any exceptions
				console.log("appstore: generate overview error: ", e);
			}
        }

        
        
        
        
        
        // Update after install (turned into separate function to avoid nested api calls)
        
        update_after_install(addon_data){
            
            window.API.getInstalledAddons()
            .then((result) => { 
				console.log("update_after_install: get_installed_addons_data: result: ");
				//console.log(result);
                this.api_addons_data = result;
                this.generate_overview('shop');
                
                if(addon_data["has_ui"] == "1"){
                    // TODO: ask the user if they want to check it out first?
                    if(addon_data["addon_id"] == 'candle-theme'){
                        setTimeout(function(){
                            window.location.reload(true); // harsh, but no UI's without backends this way.
                        }, 2000);
                    }
                    else{
                        console.log("this addon has a UI, so switching to that.");
                        window.location.pathname = '/extensions/' + addon_data["addon_id"];
                    }
                }
                
                if(addon_data["addon_id"] != 'zigbee2mqtt-adapter'){
                    document.getElementById("extension-candleappstore-selected-post-install").style.display = 'block'; 
                }
                else{
                    window.location.pathname = '/extensions/zigbee2mqtt-adapter';
                }
                
                //document.getElementById("extension-candleappstore-post-install-settings-button").setAttribute("data-addon_id", data['versions'][v]["addon_id"]);
                document.getElementById("extension-candleappstore-busy-installing").style.display = 'none';
            
			}).catch((e) => {
				console.log("get getInstalledAddons info catch (error?): ", e);
                //console.log(e);
                document.getElementById("extension-candleappstore-busy-installing").style.display = 'none';
			});
            
        }
        
        
        
        manual_uninstall(addon_id){
            // remove data dir
            if(this.debug){
                console.log("will try to manually uninstall addon: ", addon_id);
            }
    		window.API.postJson(
    			`/extensions/candleappstore/api/ajax`,
    			{'action':'uninstall','addon_id':addon_id}
    		)
            .then((body) => {
                if(this.debug){
                    console.log("Manual uninstall: removed addon? ", body);
                }
                if(typeof body.addon_dirs != 'undefined'){
                    this.installed = body.addon_dirs;
                }
                document.getElementById('extension-candleappstore-broken-addons-tip').style.display = 'block';
            
    		})
            .catch((e) => {
    			console.log("candleappstore: error calling manually delete addon: ", e);
    		});
        }
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        //
        //  SHOW SELECTED APP
        //
        
        show_selected_app(addon_id){
            //console.log('show_selected_app');
            
            const selected = document.getElementById('extension-candleappstore-selected');
            
            document.getElementById('extension-candleappstore-selected-main').style.display = 'none';
            document.getElementById("extension-candleappstore-busy-installing").style.display = 'none';
            document.getElementById("extension-candleappstore-busy-uninstalling").style.display = 'none';
            document.getElementById('extension-candleappstore-busy-loading-app').style.display = 'flex';
            
            selected.style.display = 'block';
            
            document.getElementById('extension-candleappstore-filter-search-input').value = ''; // clear the search term, if there was one
            
            if(document.getElementById("extension-candleappstore-selected-opinion") != null){
                document.getElementById("extension-candleappstore-selected-opinion").innerHTML = "";
            }
            
            const url = "get_app.php?addon_id=" + addon_id;
            //console.log(url);
    
            this.get_data(url)
            .then(data => {
                if(this.debug){
    				console.log("show_selected_app: GET APP response: ");
    				console.log(data);
                }
                
                //this.show_selected_app(data_addon_id, response, target.getAttribute('data-installed') ); // data, and whether it is installed already
                
                try{
                    
                    document.getElementById('extension-candleappstore-busy-loading-app').style.display = 'none';
                    //console.log("in show_selected_app");
                    //console.log(data);
                
                    //const pre = document.getElementById('extension-candleappstore-response-data');
                    //const selected = document.getElementById('extension-candleappstore-selected');
                    const selected_options_bar = document.getElementById("extension-candleappstore-selected-options");
                    
                    selected.style.display = 'block';
               
                    document.getElementById('extension-candleappstore-screenshots').innerHTML = "";
                    
                
                    document.getElementById("extension-candleappstore-selected-main").style.display = 'block';
                    document.getElementById("extension-candleappstore-selected-post-install").style.display = 'none';
                
                    document.getElementById("extension-candleappstore-review-response").innerText = "";

                    document.getElementById("extension-candleappstore-review-container").style.display = "none";
                    document.getElementById('extension-candleappstore-review-complete').style.display = "none";
                    
                    document.getElementById('extension-candleappstore-selected-main').style.display = 'block';
                    
                
                    if(typeof data.error != 'undefined'){
                        //console.log("There was an arror showing the app. Maybe server gave a bad response?");
                        console.log("There was a error. Details could not be loaded. It could be a connection error, or - less likely - an unknown app.");
                        selected.style.display = 'none';
                        return;
                    }
                
                    //installed = !!Number(installed); // turn into boolean
                    
                    
                    //console.log("this.installed: ", this.installed);
                    var installed = false;
                    document.getElementById('extension-candleappstore-review-tip').style.display = 'none';
                    if(this.installed.indexOf(addon_id) != -1){
                        installed = true;
                        document.getElementById('extension-candleappstore-review-tip').style.display = 'block';
                    }
                    
                    //console.log("installed: " + installed);
                    //console.log("typeof installed: " + typeof installed);
                    //console.log(data['body']);
                 
                    selected.setAttribute('data-addon-id',addon_id);
                    if(installed){
                        selected.classList.add('extension-candleappstore-installed');  
                    }
                    else{
                        selected.classList.remove('extension-candleappstore-installed');  
                    }
                    
                
                    var v = 0;
                
                    //console.log("data['versions'][v]: ", data['versions'][v]);
                    if(typeof data['versions'] != 'undefined'){
                        const keys = Object.keys(data['versions'][v]);
                
                        if(this.debug){
                            console.log("data['versions'][v]: ", data['versions'][v]);
                        }
                
            			keys.forEach((info, index) => {
                            try{
                                try{
                                    //console.log(" -------------> ", index, info, data['versions'][v][info]);
                                }
                                catch(e){
                                    //console.log(" -------------> ", index, info);
                                }
                    
                                const element_id = 'extension-candleappstore-selected-' + this.makeSafeForCSS(info);
                                const selector_name = '.' + element_id;
                    
                                var target_element = null;
                                try{
                                    //console.log("looking for element: " + selector_name);
                                    var target_element = selected.querySelector( selector_name );
                                }
                                catch(e){
                                    //console.log("Unable to find matching '" + info + "' element in app details view: " + e);
                                }

                    
                                if(target_element == undefined || target_element == null){
                                    //console.log("no matching selected-css tag element was found: ", element_id); // No quick way to dump the data
                                    return;
                                }
                                //console.log("-target element found");
                                //target_element.innerHTML = "";
                    
                                if(typeof data['versions'][v][info] != 'undefined'){
                                    //console.log("-target intended content exists: ", data['versions'][v][info]);
                                    if(data['versions'][v][info] != null){
                                        //console.log("warning, value is null");
                                    //}
                                        try{
                                            if( info.endsWith("_url") ){
                                           //console.log("adding URL to href");
                                                target_element.href = data['versions'][v][info];
                                            }
                                            else if(info == 'description'){
                                           //console.log("adding description");
                                                if(typeof data['versions'][v][info] != 'undefined'){
                                                    target_element.innerHTML = linkify(data['versions'][v][info], true)
                                                }
                                            }
                                            else if(info == 'tags'){
                                                //console.log("adding tags");
                                                target_element.innerHTML = "";
                                                if(typeof data['versions'][v][info] != 'undefined'){
                                                    var tags_array = data['versions'][v][info].split(",");
                                                    
                                                    if(this.developer && typeof data['versions'][v]['primary_type'] != 'undefined'){
                                                        tags_array.push(data['versions'][v]['primary_type']);
                                                    }
                                                    
                                                    //console.log("tags array: ", tags_array);
                                                    for (var j = 0; j < tags_array.length; j++) {
                                                        if(tags_array[j].length > 2){
                                                            var s = document.createElement("span");
                                        					s.classList.add('extension-candleappstore-tag');                
                                        					var t = document.createTextNode(tags_array[j]);
                                        					s.appendChild(t);
                                                            //s.addEventListener('click', (event) => {
                                                            //    console.log('clicked on tag: ', event.target.innerText);
                                                            //});
                                                            target_element.append(s);
                                                        }
                                                    }
                                                }
                                                else{
                                                    //console.log("no tags present");
                                                }
                                    
                                            }
                                
                                            else if(info == 'screenshots'){
                                                //console.log("[ ]");
                                                //console.log('in screenshot');
                                    
                                
                                                var screenshot1 = document.createElement('img');
                                                screenshot1.style.opacity = 0
                                                screenshot1.onload = function() {
                                                    this.style.opacity = 1;
                                                };
                                                screenshot1.src = 'https://www.candlesmarthome.com/appstore/images/' + String(addon_id) + '/screenshot.jpg';
                                                target_element.appendChild(screenshot1);
                                            
                                                var screenshot2 = document.createElement('img');
                                                screenshot2.style.opacity = 0
                                                screenshot2.onload = function() {
                                                    this.style.opacity = 1;
                                                };
                                                screenshot2.src = 'https://www.candlesmarthome.com/appstore/images/' + String(addon_id) + '/screenshot.png';
                                                target_element.appendChild(screenshot2);
                                
                                                //document.getElementById('extension-candleappstore-screenshots').appendChild(img);
                                
                                            }
                                            else if(info == 'risk'){
                                                // skip for now, show community judgement instead. Or generate it, and then let community values override it?
                                                /*
                                                const risk_score = parseInt(data['versions'][v][info]);
                                                var glasses = "";
                                                for (let s = 0; s < 5; s++) {
                                                    if( s < rounded_risk){
                                                        glasses += '&#128083;';
                                                    }
                                                    else{
                                                        glasses += '<span>&#128083;</span>';
                                                    }
                          
                                                }
                                                document.getElementById('extension-candleappstore-selected-risk').innerHTML = glasses;
                                                */
                                                
                                            }
                                            
                                            
                                            else if(info == 'privacy_score'){
                                                const privacy_protection_score = parseInt(data['versions'][v][info]);
                                                //console.log("privacy_protection_score: ", privacy_protection_score);
                                                //var privacy_protection_html = '<img src = "../images/privacy-icon.svg" alt="privacy protection icon" />'
                                                
                                                var privacy_protection_html = "";
                                                for (let p = 0; p < 5; p++) {
                                                    if( p < privacy_protection_score){
                                                        privacy_protection_html += '<img src = "/extensions/candleappstore/images/privacy-icon.svg" alt="privacy protection icon" class="extension-candleappstore-good-privacy-icon" title="More closed eye icons means stronger privacy protection"/>';
                                                    }
                                                    else{
                                                        privacy_protection_html += '<img src = "/extensions/candleappstore/images/no-privacy-icon.svg" alt="privacy protection icon" class="extension-candleappstore-bad-privacy-icon" title="More closed eye icons means stronger privacy protection"/>';
                                                    }
                          
                                                }
                                                //document.getElementById('extension-candleappstore-selected-risk').innerHTML = glasses;
                                                
                                                target_element.innerHTML = privacy_protection_html;
                                                
                                            }
                                            
                                            else{
                                                target_element.innerHTML = "";
                                                const text_to_use = data['versions'][v][info];
                                                //console.log("text_to_use: " + text_to_use);
                                                //console.log("filling in left-over value: ", data['versions'][v][info], 'into: ', target_element);
                                                //target_element.innerHTML = "xxx" + text_to_use;
                                                //var spanny = document.createElement("span");
                                                var texty = document.createTextNode(text_to_use);
                                                //spanny.appendChild(texty);
                                                target_element.appendChild(texty);
                                                //console.log("selector_name = " + selector_name);
                                                //s.id = element_id;
                                                //s.classList.add('extension-candleappstore-nice-name-span');      
                                                //var t = document.createTextNode(data['versions'][v][info]);
                                                //s.appendChild(t);
                                                //target_element.innerHTML = data['versions'][v][info];
                                                //target_element.appendChild(t);
                                            }
                        
                                        }
                                        catch(e){
                                            console.log("Error populating selected: " + e);
                                        }
                                    }
                                    else{
                                        //console.log("it was null");
                                    }
                            
                                }
                            }
                            catch(e){
                                console.log("Error generating content element for single app overlay: ", e);
                            }
                    
                        });
                    }
                    else{
                        //console.log("weird, no versions? ", data);
                    }
                
                    selected_options_bar.innerHTML = "";
                
                
                    // ADD INSTALL BUTTON
                
                    if( !installed && data['versions'][v]["addon_id"] != undefined && data['versions'][v]["download_url"] != undefined && data['versions'][v]["checksum"] != undefined ){
                        
                        if( this.addons_being_installed.indexOf( data['versions'][v]["addon_id"] ) == -1 ){
                            this.addons_being_installed.push( data['versions'][v]["addon_id"] );
                            
                            var b = document.createElement("button");
                            b.classList.add('extension-candleappstore-selected-install-button');
                            b.classList.add('extension-candleappstore-button');
                            var t = document.createTextNode("Install");
                            b.appendChild(t);
        					b.addEventListener('click', (event) => {
                                //console.log("install button clicked");
                                //console.log(event);
                            
                                event.stopImmediatePropagation();
                            
                                if(this.exhibit_mode){
                                    console.log("not installing - exhibit mode active");
                                    alert("Sorry, cannot install while in exhibit mode");
                                    return;
                                }
                            
                                event.target.style.display = 'none';
                            
                                //selected.style.display = 'none';
                            
                                document.getElementById("extension-candleappstore-busy-installing").style.display = 'block';
                                document.getElementById('extension-candleappstore-selected-main').style.display = 'none';
                            
                                if(this.debug){
                                    console.log("data['versions'][v]: ", data['versions'][v]);
                                    console.log( "installing addon. parameters: ", data['versions'][v]["addon_id"], data['versions'][v]["download_url"], data['versions'][v]["checksum"] );
                                }
                            
                                document.getElementById('extension-candleappstore-busy-installing-name').innerText = data['versions'][v]["addon_id"];
                            
                                window.API.installAddon( data['versions'][v]["addon_id"], data['versions'][v]["download_url"], data['versions'][v]["checksum"] )
                                .then((result) => { 
        							if(this.debug){
                                        console.log("installation result: ", result);
                                    }
                                    this.api_addons_data = []; // Remove the existing data about addons so that it will be re-requested from the window.API
                                
                                    if(typeof result.enabled != "undefined"){
                                        console.log("addon installed succesfully");
                                        this.installed.push(data['versions'][v]["addon_id"]);
                                        if(result.enabled == true){
                                            console.log("- addon is enabled");
                                        
                                    
                                            //this.generate_overview('shop');
                                        }
                                        else{
                                            console.log("- addon is NOT enabled");
                                            //console.log("installed ok, but is disabled?");
                                        }
                                    }
                                    else{
                                        //console.log("installation failed, severely");
                                        alert("Error: could not install.");
                                    }
                            
                                    this.update_after_install(data['versions'][v]);
                                    
                                    // Remove addon name from being installed list
                                    for (var t = this.addons_being_installed.length-1; t >= 0; t--) {
                                        if (this.addons_being_installed[t] == data['versions'][v]["addon_id"]) {
                                            this.addons_being_installed.splice(t, 1);
                                        }
                                    }


        						}).catch((e) => {
        							console.log("installation catch (error?): ", e);
                                
                                    //console.log(e);
        							//pre.innerText = e.toString();
                                    //alert("Error: could not install. Could not connect to the controller.");
                                    document.getElementById("extension-candleappstore-busy-installing").style.display = 'none';
                                    document.getElementById("extension-candleappstore-installation-failed").style.display = 'block';
                                    
                                    // Remove addon name from being installed list
                                    for (var t = this.addons_being_installed.length-1; t >= 0; t--) {
                                        if (this.addons_being_installed[t] == data['versions'][v]["addon_id"]) {
                                            this.addons_being_installed.splice(t, 1);
                                        }
                                    }
                                    
        						});
                            });
                            
                            //console.log("adding install button");
                            if( this.installed.indexOf(data['versions'][v]["addon_id"]) == -1 ){
                                selected_options_bar.appendChild(b);
                            }
                        
                        }
                        else{
                            console.log('this addon is already being installed');
                            document.getElementById('extension-candleappstore-busy-installing-name').innerText = data['versions'][v]["addon_id"];
                            document.getElementById("extension-candleappstore-busy-installing").style.display = 'block';
                            document.getElementById('extension-candleappstore-selected-main').style.display = 'none';
                        }
                    
                    }
                
                
                    // ADD UNINSTALL BUTTON
                
                    else if( installed && data['versions'][v]["addon_id"] != undefined ){
                    
                        if(data['versions'][v]["addon_id"] != 'candleappstore'){
                            
                            var b = document.createElement("button");
                            b.classList.add('extension-candleappstore-selected-uninstall-button');
                            b.classList.add('extension-candleappstore-button');
                            //b.disabled = true;
                            var t = document.createTextNode("Uninstall");
                            b.appendChild(t);
        					b.addEventListener('click', (event) => {
                                //console.log("uninstall button clicked");
                               //console.log(event);
                                event.stopImmediatePropagation();
                                //console.log( data['versions'][v]["addon_id"] );
                                
                                if(this.exhibit_mode){
                                    console.log("Cannot uninstall while in exhibit mode");
                                    alert("Sorry, cannot uninstall while in exhibit mode");
                                    return;
                                    
                                }
                                
                                const addon_id = data['versions'][v]["addon_id"];
                        
                                
                                if(addon_id == 'candle-theme' && this.developer == false){
                                    console.log("The Candle theme can only be uninstalled in developer mode");
                                    return;
                                }
                                
                        
                                var really = confirm("Are you sure you want to uninstall this addon?");
                                if (really) {
                                    document.getElementById("extension-candleappstore-busy-uninstalling").style.display = 'block';
                                    document.getElementById('extension-candleappstore-selected-main').style.display = 'none';
                                    
                                    window.API.uninstallAddon( data['versions'][v]["addon_id"] )
                                    .then((result) => { 
            							if(this.debug){
                                            console.log("uninstallation result: ", result);
                                            //console.log("addon_id: " + addon_id + " was uninstalled, in theory.");
                                        }
                                        document.getElementById("extension-candleappstore-selected").style.display = 'none';
                                        //document.getElementById("extension-candleappstore-settings").style.display = 'none';
                            
                                        //console.log("this.installed = " + this.installed );
                                        for (var i=this.installed.length-1; i>=0; i--) {
                                            if (this.installed[i] === addon_id) {
                                           //console.log("popping addon from this.installed list: ", addon_id);
                                                this.installed.splice(i, 1);
                                            }
                                        }
                                        window.API.getInstalledAddons()
                                        .then((result) => { 
                            				if(this.debug){
                                                console.log("get_installed_addons_data: result: ");
                                            }
                            				//console.log(result);
                                            this.api_addons_data = result;
                                            this.generate_overview('installed'); // user might have come from either page
                                            this.generate_overview('shop');
                                            document.getElementById("extension-candleappstore-busy-uninstalling").style.display = 'none';
                                            // post-uninstall here?
                                
                            			}).catch((e) => {
                            				console.log("get getInstalledAddons info catch (error?): ", e);
                                            //console.log(e);
                                            document.getElementById("extension-candleappstore-busy-uninstalling").style.display = 'none';
                            			});
                                        
                                        
                                        // remove data dir
                                        if(this.debug){
                                            console.log("will try to remove data dir for addon: ", addon_id);
                                        }
                            			window.API.postJson(
                            				`/extensions/candleappstore/api/ajax`,
                            				{'action':'uninstall','addon_id':addon_id}
                            			)
                                        .then((body) => {
                                            if(this.debug){
                                                console.log("Uninstall: removed addon data dir? ", body);
                                            }
                                            if(typeof body.addon_dirs != 'undefined'){
                                                this.installed = body.addon_dirs;
                                            }
                                            
                                            
                            			})
                                        .catch((e) => {
                            				console.log("candleappstore: remove addon data dir error: ", e);
                            			});
                                        
                            
            						}).catch((e) => {
            							console.log("uninstallation catch (error?)", e);
            						});
                                }
                        
                            });
                            //console.log("adding uninstall button");
                            selected_options_bar.appendChild(b);
                        }
                    
                    }
                
                
                    //
                    //  POST INSTALL
                    //
                
                    // Prepare the post-install view settings button
                    /*
                    document.getElementById('extension-candleappstore-post-install-settings-button').addEventListener('click', (event) => {
                        //console.log(event.target.dataset.addon_id);
                        document.getElementById("extension-candleappstore-selected").style.display = 'none';
                        this.show_addon_config(event.target.dataset.addon_id);
                    
                    });
                
                    */
                    //console.log("Should add post-install button now.");
                
                    var b = document.createElement("button");
                    b.classList.add('extension-candleappstore-selected-settings-button');
                    b.classList.add('extension-candleappstore-button');
                    b.classList.add('addon-settings-config');
                    b.classList.add('text-button');
                    b.setAttribute('id','extension-candleappstore-post-install-settings-button');
                    b.setAttribute('data-addon-id', data['versions'][v]["addon_id"]);
                    var t = document.createTextNode("Settings");
                    b.appendChild(t);
                    //console.log("button: ", b);
    				/*
                    b.addEventListener('click', (event) => {
                   //console.log("settings button clicked");
                   //console.log(event);
                        event.stopImmediatePropagation();
                   //console.log("clicked on settings button for: ", addon_id );
                   //console.log( event.target.getAttribute('data-addon-id') );
                    
                        // Show settings overlay
                        //settings_container.style.display = 'block';
                        //settings_container.classList.add("extension-candleappstore-busy");
        
                        //this.get_installed_addons_data();
                        this.show_addon_config( event.target.getAttribute('data-addon-id'));
        
                    });*/
                    //console.log("adding post-install settings button");
                    const post_install_button_container = document.getElementById("extension-candleappstore-post-install-settings-button-container");
                    //console.log("post_install_button_container: ", post_install_button_container);
                    document.getElementById("extension-candleappstore-post-install-settings-button-container").innerHTML = "";
                    document.getElementById("extension-candleappstore-post-install-settings-button-container").appendChild(b);
                
                    //console.log("post install settings button: ", document.getElementById("extension-candleappstore-post-install-settings-button"));
                
                    window.setTimeout(() =>{
                        document.getElementById("extension-candleappstore-post-install-settings-button").addEventListener('click', (event) => {
                            //console.log("post-install settings button clicked");
                            //console.log(event);
                            event.stopImmediatePropagation();
                            //console.log("clicked on settings button for: ", addon_id );
                            //console.log( event.target.getAttribute('data-addon-id') );
                        
                            // Show settings overlay
                            //settings_container.style.display = 'block';
                            //settings_container.classList.add("extension-candleappstore-busy");
                            document.getElementById('extension-candleappstore-selected').style.display = 'none';
                            //this.get_installed_addons_data();
                            this.show_addon_config( event.target.getAttribute('data-addon-id'));

                        });
                    },100);
                
    
                    //clone.setAttribute('data-installed', 1);
                    //var target_element = clone.querySelectorAll( '.extension-candleappstore-basic-options' )[0];
                    //if(page != 'updates'){
                    //    target_element.appendChild(b);
                    //}
                
                
                    //*/
                
                
                
                }
                catch(e){
                    console.log("Error in show selected app: ", e);
                }
                
                
                //console.log("next: generate reviews");
                //console.log("data: ", data);
                
                //
                //  REVIEWS
                //
            
                try{
                    // SHOW RATINGS
                    // handles the display of the last 100 ratings
                
                    const original_review_item = document.getElementById('extension-candleappstore-original-review-item');
                    const reviews_container = document.getElementById('extension-candleappstore-reviews-container');
                    const reviews_list = document.getElementById('extension-candleappstore-reviews-list');
                    //reviews_container.style.display = "none";
                    reviews_list.innerHTML = "There are no reviews yet. Be the first!";
                    document.getElementById('extension-candleappstore-review-histogram-container').style.display = 'none';
                
                    if( data.hasOwnProperty('ratings') ){
                        //reviews_container.style.display = "block";
                        //console.log(data['ratings'].length + " RATING(S) EXIST");
                        
                        document.getElementById('extension-candleappstore-review-histogram-container').style.display = 'block';
                        
                        var rating_count = "100+";
                        if(data['ratings'].length < 100){
                            rating_count = data['ratings'].length;
                        }
                        document.getElementById('extension-candleappstore-histogram-total-rating-count').innerText = rating_count;
                    
                        var ratings_added_up = 0;
                        var risk_added_up = 0;
                        var risk_counter = 0;
                        var ratings_count_array = [0,0,0,0,0,0];
                    
                        if(data['ratings'].length > 0){
                            reviews_list.innerHTML = "";
                        }
                    
                    
                    
                        const pixels_per_opinion = Math.floor( 100 / data['ratings'].length);
                    
                        for(let i = 0; i < data['ratings'].length; i++){
                            //console.log( data['ratings'][i] );
                        
                            var clone = original_review_item.cloneNode(true);
                            clone.removeAttribute('id');
                            //clone.setAttribute('data-addon-id', data[i].addon_id);
                            //clone.style.background = "#" + this.string_to_color(data[i].addon_id);
                    
                            const keys = Object.keys(data['ratings'][i]);
                            //console.log(keys);
        					keys.forEach((info, index) => {
                                //console.log(info);
                            
                                const selector_name = '.extension-candleappstore-review-item-' + info;
                                //console.log("selector name: " + selector_name);
                                var target_element = clone.querySelectorAll( selector_name )[0];
                                if(target_element != undefined){
                                    //console.log("- element existed");
                                    //if(info == 'review' || info == 'username'){
                                    
                                    if(info == 'rating'){
                                        var number = parseInt(data['ratings'][i][info]);
                                        var stars = "";
                                        for (let s = 0; s < 5; s++) {
                                            if( s < number){
                                                stars += '★';
                                            }
                                            else{
                                                stars += '<span>★</span>';
                                            }
                                      
                                        }
                                        target_element.innerHTML = stars;
                                    }
                                    else if(info == 'risk'){
                                        var number = 1 + parseInt(data['ratings'][i][info]/2);
                                            var glasses = "";
                                            for (let s = 0; s < 5; s++) {
                                                if( s < number){
                                                    glasses += '<img src="/extensions/candleappstore/images/book.svg"/>';
                                                }
                                                else{
                                                    glasses += '<span><img src="/extensions/candleappstore/images/book.svg"/></span>';
                                                }
                                      
                                            }
                                            target_element.innerHTML = glasses;
                                    
                                    }
                                    
                                    
                                    
                                    else{
                                        //var t = document.createTextNode( htmlDecode() );
                                        //target_element.appendChild(t);
                                    
                                        target_element.innerHTML = data['ratings'][i][info];
                                    }
                                
                                    //}
                                }
                                /*
                                else if( info == 'ip' ){
                                    var a = document.createElement("a");
                                    a.classList.add('extension-candleappstore-ip-link');
                                    const url = window.location.href;
                                    a.href = url.split("/")[0] + '//' + this.animals[mac][info]
                                    var h = document.createTextNode(this.animals[mac][info]);
                                    a.appendChild(h);
                            
                                    const selector_name = '.extension-candleappstore-' + info;
                                    var target_element = clone.querySelectorAll( selector_name )[0];
                                    target_element.appendChild(a);
                                }
                                else if(info == 'protected'){
                                    clone.querySelectorAll( '.extension-candleappstore-domains' )[0].innerHTML = '<p class="extension-candleappstore-privacy-warning">This device has connected to so many domains that it may be a laptop or mobile phone. To safeguard privacy its connection log will not be shown.</p>';
                                    clone.querySelectorAll( '.extension-candleappstore-item-clear-button' )[0].remove();
                            
                                }
                                */
                            
                            
                                if(info == 'risk'){
                                    if(data['ratings'][i][info] != undefined){
                                        risk_counter++; //remember how often a risk score was found
                                        risk_added_up = risk_added_up + parseInt(data['ratings'][i]['risk']);
                                    }
                                }
                            
                    
                            });
                        
                            //clone.classList.add("installed");
                            //clone.setAttribute('data-installed', 0);
                            reviews_list.appendChild(clone); 
                            ratings_added_up = ratings_added_up + Number(data['ratings'][i]['rating']);
                        
                            ratings_count_array[ data['ratings'][i]['rating'] ]++;
                        
                        }
                        //console.log("ratings_added_up = " + ratings_added_up);
                        const average_rating = ratings_added_up / data['ratings'].length;
                        //console.log("average_rating = " + average_rating);
                        //const rounded_rating = Math.round(average_rating * 10) / 10;
                        const rounded_rating = ((average_rating * 10) /10 ).toFixed(1);
                        document.getElementById('extension-candleappstore-histogram-average-rating').innerText = rounded_rating;
                    
                        //console.log(ratings_count_array);
                        for(let r = 1; r < ratings_count_array.length; r++){
                            //const target_rating_counter = 
                        
                            document.getElementById('extension-candleappstore-histogram-rating-count' + r).innerText = ratings_count_array[r];
                            document.getElementById('extension-candleappstore-histogram-bar' + r).style.width = 1 + (ratings_count_array[r] * pixels_per_opinion) + "px";
                        
                        }
                        
                        if(risk_counter > 1){
                            const average_risk = risk_added_up / risk_counter;
                            const rounded_risk = 1 + Math.floor(average_risk / 2 );
                            //document.getElementById('extension-candleappstore-histogram-average-rating').innerText = 4;
                            //console.log("risk_counter: ", risk_counter);
                            //console.log("risk_added_up: ", risk_added_up);
                        
                            //console.log("rounded_risk: ", rounded_risk);
                        
                            var glasses = "";
                            for (let s = 0; s < 5; s++) {
                                if( s < rounded_risk){
                                    glasses += '<img src="/extensions/candleappstore/images/book.svg"/>';
                                }
                                else{
                                    glasses += '<span><img src="/extensions/candleappstore/images/book.svg"/></span>';
                                }
                          
                            }
                            document.getElementById('extension-candleappstore-selected-risk').innerHTML = glasses;
                        
                        }
                    
                    }
                    else{
                        //console.log("NO REVIEWS YET");
                    }
                
                    
                    
                
                    /*
                    const stars = document.getElementById("extension-candleappstore-stars-rating");
                    stars.addEventListener('click', function(event) {
                   //console.log(event);
                        const target = event.target;
                        if (event.target.tagName.toLowerCase() === 'label') {
                       //console.log("clicked on a star");
                       //console.log( event.target.htmlFor.slice(-1) );
                            document.getElementById("extension-candleappstore-review-container").style.display = "block";
                        }
                    });
                    */
                

                    /*
                    // Get data for apps overview
                    this.get_data("login_json.php",login_data).then(response => {
                   //console.log("LOGIN RESPONSE!");
                   //console.log(response);
                   //console.log("typeof response = " + typeof response);
                    
                        if(response.hasOwnProperty('username')){
                    */
                
                
                
                    /*
                    var children = stars.children;
                    for (var i = 0; i < children.length; i++) {
                      var star = children[i];
                      // Do stuff
                    }
                
                    const parent = document.querySelector(selector);
                    Array.from(parent.children).forEach((child, index) => {
                      // Do stuff
                    });
                    */
                
                }
                catch(e){
                    console.log("Error in adding ratings to selected app display: ", e);
                }   
                
                document.getElementById('extension-candleappstore-view').style.zIndex = '3';
                
            })
            .catch((e) => {
				console.log("candleappstore: error while getting detailed data about an addon: ", e);
			});
            
            
             

            
        }
        
        
        
        
        
        
        //
        //  SHOW ADDON SETTINGS
        //
        
        show_addon_config(addon_id){ // ingests .schema data from self.api_addon_data
            try{
                //console.log("in show_addon_config for: " + addon_id);
                
                // Clean up from previous addon settings
                const pre = document.getElementById('extension-candleappstore-response-data');
                const form = document.getElementById('extension-candleappstore-settings-form');
                const advanced_form = document.getElementById('extension-candleappstore-advanced-settings-form');
                const advanced_form_container = document.getElementById("extension-candleappstore-advanced-settings-form-container");
                const settings_options_bar = document.getElementById("extension-candleappstore-settings-options");
                const permissions_dropdown = document.getElementById("extension-candleappstore-permissions");
                
                document.getElementById("extension-candleappstore-settings-title").innerText = "";
                document.getElementById('extension-candleappstore-settings-options').style.display = 'block';
                form.innerHTML = "";
                advanced_form.innerHTML = "";
                //if(this.developer == false){
                //    advanced_form.style.display = 'none';
                //}
                
                settings_options_bar.innerHTML = "";
                advanced_form_container.style.display = "none";
                
                
                
                //extension-candleappstore-show-advanced-settings-button
                
                
                document.getElementById('extension-candleappstore-show-advanced-settings-button').addEventListener('click', (event) => {
                    document.getElementById('extension-candleappstore-advanced-settings-form').style.display = 'block';
                });
                
                
                
                // Show settings overlay
                const settings_container = document.getElementById('extension-candleappstore-settings');
                settings_container.style.display = 'block';
                settings_container.classList.add("extension-candleappstore-busy");
                
                
                //window.API.getAddonsInfo()
                window.API.getInstalledAddons()
                .then((installed_adons_data) => {
                    if(this.debug){
					    console.log("get installed_adons_data result: ");
					    console.log(installed_adons_data);
                    }
                    
                    
                    window.API.getAddonConfig( addon_id )
                    .then((data) => { 
                        if(this.debug){
    					    console.log("get addon config result: ", data);
                        }
    					//console.log(data);
                        //console.log(data['body']);
                
                        //var spotted_advanced_setting = false;
            

                        settings_container.classList.remove("extension-candleappstore-busy");
                
                        const data_keys = Object.keys(data);
                        if(data_keys.length == 0){
                            //console.log('This addon does not have any saved preferences yet');
                            form.innerHTML = '<p>This addon does not have any saved preferences yet.</p>';
                            //return;
                        }
                        //console.log("data keys length = " + data_keys.length);
                        
                        /*
                        // let the api_data loop handle this.
                        var abort = false;
                        data_keys.forEach((info, index) => {
                           //console.log("typeof data[info] = " + typeof data[info]);
                            if(typeof data[info] == 'object'){
                                //console.log("This addon has a complex object in its settings. Creating redirect button.");
                                form.innerHTML = '<a href="/settings/addons/config/' + addon_id + '"><button>Click here to change settings</button></a>';
                                abort = true;
                                return;
                            }
                        });
                        
                        if(abort){
                            //console.log("aborting generating config fields");
                            return;
                        }
                        */
                
                        var addon_settings_schema = {};
                        var api_data = null;
                        for(let f = 0; f < this.api_addons_data.length; f++){
                            //console.log(f);
                            if( this.api_addons_data[f]['id'] == addon_id ){
                                //console.log("bingo. this.api_addons_data[f]: ", this.api_addons_data[f])
                                api_data = this.api_addons_data[f];
                                if(this.api_addons_data[f].hasOwnProperty('schema')){
                                    addon_settings_schema = this.api_addons_data[f]['schema'];
                                }
                                break;
                            }
                        }
                        if(addon_settings_schema == {}){
                            form.innerHTML = '<span class="extension-candleappstore-error">Error, could not load settings</span>';
                            return;
                        }
                        //console.log("api_data = ");
                        //console.log(api_data);
                
                        if(api_data != null){
                            document.getElementById("extension-candleappstore-settings-title").innerText = api_data.name;
                        }
                
                        //console.log("window.origin = " + window.origin);
                
                        if(!addon_settings_schema.hasOwnProperty('properties')){
                            form.innerHTML = '<span class="extension-candleappstore-info">This addon does not have any settings.</span>';
                            return;
                        }
    
                
                        //console.log("addon_settings_schema:", addon_settings_schema);
                
                        const addon_settings_props = addon_settings_schema['properties'];
                
                        var addon_settings_required = [];
                        if(addon_settings_schema.hasOwnProperty('required')){
                            addon_settings_required = addon_settings_schema['required'];
                        }
                
                        const settings_keys = Object.keys(addon_settings_props);
                        if(this.debug){
                            console.log("addon_settings_props:");
                            console.log(addon_settings_props);
                        }
                        //console.log("all props: " + settings_keys);
                        //console.log("addon_settings_required = " + addon_settings_required);
                
                
                        var stop_processing = false;
                
                        // Looping over the fields defined in the api_data schema
                        settings_keys.forEach((info, index) => {
                            if(this.debug){
                                console.log("appstore debug: adding setting item: " + info);
                            }
                            
                            var advanced = false;
                            var is_required = false;
                    

                            if(stop_processing){return;} // weird that return false didn't work.

                            // CREATE DIV
                            const css_element_id = 'extension-candleappstore-settings-setting-' + this.makeSafeForCSS(info);
                            var d = document.createElement("div");
                            d.classList.add("extension-candleappstore-settings-item");
                            //var left_div = document.createElement("div");
                    
                            // REQUIRED?
                            if( addon_settings_required != undefined){
                                if(addon_settings_required.indexOf(info) != -1){
                                    //console.log("-is_required");
                                    is_required = true;
                                    d.classList.add('extension-candleappstore-required-setting');      
                                }
                            }
                    
                    
                            // LABEL
                            var l = document.createElement("label");
                            l.for = info;
                            var t = document.createTextNode(info);
                            l.appendChild(t); // append text to label
                
                            
                            //s.classList.add('extension-candleappstore-nice-name-span');      
                            //var t = document.createTextNode(data[i][info]);
                            //s.appendChild(t);
                            
                            
                    
                    
                    
                            // DESCRIPTION, and detect 'advanced'.
                            var description = addon_settings_props[info]['description'];
                            var p = document.createElement("p");
                            if(description != undefined){
                                if( description.startsWith('Advanced.') ){
                                    //console.log("descriptions started with Advanced.");
                                    advanced = true;
                                    description = description.replace('Advanced. ','');
                                    description = description.replace('Advanced.','');
                                }
                                //console.log(description);
                        
                                var pt = document.createTextNode(description);
                                p.appendChild(pt); // append description text to paragraph
                            }
                    
                            //d.appendChild(p);
                    
                            if(this.debug){
                                console.log("appstore debug: creating input: ", addon_settings_props[info]);
                            }
                            
                            
                            try{
                                //console.log("\n\nstored preference: ", data[info]);
                                
                                // BOOLEAN SWITCH
                                
                                if( addon_settings_props[info]['type'] == 'boolean' || addon_settings_props[info].hasOwnProperty('boolean')){
                                //if(addon_settings_schema[info] == "true" || data[info] == "false"){
                                    
                                    var left = document.createElement("div");
                                    left.classList.add("extension-candleappstore-settings-left");
                                    left.appendChild(l); // append label to div
                                    left.appendChild(p); // Append description to div
                                    d.appendChild(left);
                                    d.classList.add("extension-candleappstore-flex");
                                    
                                    /// Hide debugging option unless developer mode is enabled
                                    //if(info.toLowerCase() == 'debug' || info.toLowerCase() == 'debugging'){
                                    if(info.toLowerCase().startsWith('debug')){
                                        d.classList.add('extension-candleappstore-hidden-setting'); 
                                    }
                                    
                                    //console.log("boolean spotted. checked = " + data[info]);
                                    var s = document.createElement("input");
                                    s.id = css_element_id
                                    
                                    s.name = info;
                                    s.type = "checkbox";
                                    if(data[info] == true || data[info] == 'true'){
                                        //console.log("checking box");
                                        s.checked = true;
                                    }
                                    d.appendChild(s);
                            
                                    //d.appendChild(p); // append description to div
                            
                                }
                                
                                // ENUM
                                
                                else if( addon_settings_props[info]['type'] == 'enum' || addon_settings_props[info].hasOwnProperty('enum') ){ // not sure is that second part is needed.
                                    //console.log("should create enum");
                                    
                                    
                                    var left = document.createElement("div");
                                    left.classList.add("extension-candleappstore-settings-left");
                                    left.appendChild(l); // append label to div
                                    left.appendChild(p); // Append description
                                    d.appendChild(left);
                                    d.classList.add("extension-candleappstore-flex");
                                    d.classList.add('extension-candleappstore-settings-enum');
                                    
                                    var s = document.createElement("select");
                                    s.name = info;
                                    s.id = css_element_id;
                                    if(is_required){
                                        s.required = true;
                                    }
                            
        							//const property_lists = this.get_property_lists(this.all_things[thing]['properties']);
        							//console.log("property lists:");
        							//console.log(property_lists);
							
                                    for(let q = 0; q < addon_settings_props[info]['enum'].length; q++){
        							//for( var title in data[info]['enum'] ){
                                        const option_name = addon_settings_props[info]['enum'][q];
        								//console.log("adding enum option: " + option_name);
                                        const new_option_element = new Option(option_name, option_name);
								
                                        if(data[info] == option_name){
                                            //console.log("spotted selected dropdown option");
                                            // found the selected item
                                            //new_option_element.selected = true;
                                            new_option_element.setAttribute("selected", "selected");
                                        }
                                        s.options[s.options.length] = new_option_element;
        							}
                                    d.appendChild(s);
                            
                                    //d.appendChild(p); // append description to div
                            
                                }
                                
                                // STRING OR NUMBER
                                
                                else if( addon_settings_props[info]['type'] == 'string' || addon_settings_props[info].hasOwnProperty('string') || addon_settings_props[info]['type'] == 'integer' || addon_settings_props[info]['type'] == 'number'){
                                    //console.log("string spotted");
                                    
                                    
                                    
                                    d.appendChild(l); // append label to div
                                    
                                    //console.log("creating input for normal string");
                                    var s = document.createElement("input");
                                    s.id = css_element_id;
                                    s.name = info;
                        
                                    var input_type = 'text';
                                    if(addon_settings_props[info]['type'] != "string"){
                                        if(addon_settings_props[info]['type'] == "integer" || addon_settings_props[info]['type'] == "number"){
                                            input_type = "number";
                                            if(typeof addon_settings_props[info]['minimum'] != 'undefined' && typeof addon_settings_props[info]['maximum'] != 'undefined'){
                                                input_type = "range";
                                                
                                                var sv = document.createElement("div");
                                                sv.id = css_element_id + "-value";
                                                sv.classList.add('extension-candleappstore-range-input-value');
                                                
                                                if(data[info] != undefined){
                                                    sv.innerText = data[info];
                                                }
                                                d.appendChild(sv);
                                                
                                                //console.log("- range. minimum: ", addon_settings_props[info]['minimum']);
                                                //console.log("- range. maximum: ", addon_settings_props[info]['maximum']);
                                                s.min = addon_settings_props[info]['minimum'];
                                                s.max = addon_settings_props[info]['maximum'];
                                                if(addon_settings_props[info]['type'] == "integer"){
                                                    s.step = 1;
                                                }
                                                s.addEventListener('input', (event) => {
                                                    //console.log('range value changed:', event, s.id, css_element_id);
                                                    //console.log(s.value);
                                                    document.getElementById(css_element_id + "-value").innerText = s.value;
                                                });
                                            }
                                            
                                        }
                                        else{
                                            input_type = addon_settings_props[info]['type'];
                                        }
                                    }
                                    else{
                                        // ugly way of creating a password field
                                        // https://github.com/WebThingsIO/gateway/issues/2918
                                        if(typeof addon_settings_props[info]['writeOnly'] != 'undefined'){
                                            if(addon_settings_props[info]['writeOnly'] == true){
                                                input_type = 'password'
                                            }
                                        }
                                    }
                                    
                                    if(info.toLowerCase() == 'authorization token' || info.toLowerCase() == 'accessToken'){
                                        d.classList.add('extension-candleappstore-hidden-setting'); 
                                    }
                        
                                    if(info.toLowerCase() == 'background color' && this.developer == false){
                                        input_type = 'color';
                                    }
                                    
                                    s.type = input_type;
                        
                                    if(data[info] != undefined){
                                        s.value = data[info];
                                    }
                                    // TODO get the initial default value and set it to that instead
                        
                        
                                    if(is_required){
                                        s.required = true;
                                    }
                        
                                    //s.classList.add('extension-candleappstore-nice-name-span');      
                                    //var t = document.createTextNode(data[i][info]);
                                    //s.appendChild(t);
                        
                        
                        
                                    d.appendChild(s); // append string input
                        
                                    d.appendChild(p); // append description to div
                                    
                                    
                                    
                                    //
                                    //  ADDING EXTRA PERMISSION DROPDOWN FOR AUTHORIZATION TOKEN
                                    //

                                    if((info.toLowerCase() == 'authorization token' || info.toLowerCase() == 'accessToken') && is_required){
                                        
                                        var token_state = null;
                                        
                                        
                                        // The this.permissions dictionary may be a bit overcomplicated for now.
                                        if(this.permissions.hasOwnProperty(addon_id)){
                                            //console.log("Info about permissions for this addon existed");
                                            if( this.permissions[addon_id].hasOwnProperty('token') ){
                                                //console.log("token state was present");
                                                token_state = this.permissions[addon_id]['token'];
                                            }
                                        }
                                        //console.log("Authorization token input field spotted");
                                        /*
                                        if(api_data != null){
                                            document.getElementById("extension-candleappstore-permissions-title").innerText = api_data['name'];
                                        }
                                        */
                        
                                        // If the token string is empty, that means the permission is 'none'.
                                        //if(token_state == null && data[info] == ""){
                                        if(token_state == null && data[info] == ""){
                                            token_state = 'none';
                                        }
                                        
                                        // Simpler: if there is a token string, there must be permission.
                                        if(typeof data[info] != 'undefined'){
                                            if(data[info] != null){
                                                if(data[info].length > 10){
                                                    //console.log("token is longer than 10 characters, so setting token state to 'full' (aka yes)");
                                                    token_state = 'full';
                                                }
                                            }
                                        }
                                        
                                        //console.log("token_state: " + token_state);
                                        
                                        //var xd = document.createElement("div");
                                        //xd.classList.add('extension-candleappstore-settings-permission-setting');
                        
                                        var xl = document.createElement("label");
                                        xl.for = this.makeSafeForCSS(info) + "-permission";
                                        var xt = document.createTextNode("Access to your things");
                                        xl.appendChild(xt); // append text to label
                    
                                        //xd.appendChild(xl); // append label to div
                        
                        
                                        //console.log("should create permission enum");
                                        var xs = document.createElement("select");
                                        xs.name = this.makeSafeForCSS(info) + "-permission";
                        
                						//const property_lists = this.get_property_lists(this.all_things[thing]['properties']);
                						//console.log("property lists:");
                						//console.log(property_lists);
						
                                        //const possible_permissions = {'none':'No access', 'read':'Read only', 'full':'Read and toggle'};
                                        const possible_permissions = {'no':'none', 'yes':'full'};
                        
                                        const permission_keys = Object.keys(possible_permissions);
                                        
                    
                    					permission_keys.forEach((preference, index) => {
                        
                                        //for(let q = 0; q < possible_permissions.length; q++){
                						//for( var title in data[info]['enum'] ){
                                            //const option_name = addon_settings_props[info]['enum'][q];
                							//console.log("adding permissions preference option: " + preference + ", " + possible_permissions[preference] );
                                            const new_option_element = new Option(preference, possible_permissions[preference]);
							
                                            if(token_state == 'full'){
                                                //console.log("spotted full permission dropdown option");
                                                // found the selected item
                                                //new_option_element.selected = true;
                                                new_option_element.setAttribute("selected", "selected");
                                            }
                                            xs.options[xs.options.length] = new_option_element;
                						});
                        
                                        xs.addEventListener('change', (event) => {
                                            //console.log("permission dropdown changed");
                                            //console.log(event);
                                            event.stopImmediatePropagation();
                                            //this.remember_permission(addon_id,'token','none');
                            
                                            //console.log("new value selected: " + event.target.value);
                                            //revokeAuthorization
                            
                                            //console.log("possible_permissions['none']: ", possible_permissions['none']);
                            
                                            

                                            if(event.target.value == 'full'){ //possible_permissions['full']){
                                                //console.log("permission was set to full");
                                                //console.log( localStorage.getItem('jwt') );
                                                //console.log("target input el: " + css_element_id);
                                                document.getElementById(css_element_id).value = localStorage.getItem('jwt');
                                
                                                //http://thuis.local/oauth/authorize?response_type=code&client_id=local-token&scope=/things:readwrite&state=asdf
                                            }
                                            /*
                                            else if(event.target.value == 'read'){ //possible_permissions['read']){
                                                //console.log("permission was set to read only");
                                
                                                // http://thuis.local/oauth/authorize?response_type=code&client_id=local-token&scope=/things:readwrite&state=asdf
                                            }
                                            */
                                            else{ //if(event.target.value == 'none'){ //possible_permissions['none']){
                                                //console.log("permission was set to none or was still null. Revoke?");
                                                document.getElementById(css_element_id).value = "";
                                            }
                                            
                                        });
                        
                                        // Add description
                                        var xp = document.createElement("p");
                                        const xpt = document.createTextNode("This app requires permission to control and get data from your devices in order to function. Is that ok?");
                                        xp.appendChild(xpt);
                                        //xd.appendChild(xp); // append description to div
                        
                                        
                                        var left = document.createElement("div");
                                        left.classList.add("extension-candleappstore-settings-left");
                                        left.appendChild(xl); // append label to div
                                        left.appendChild(xp); // Append description
                                        
                                        var permission_div = document.createElement("div");
                                        permission_div.appendChild(left);
                                        permission_div.appendChild(xs);
                                        
                                        permission_div.classList.add('extension-candleappstore-required-setting');
                                        permission_div.classList.add('extension-candleappstore-settings-item');
                                        permission_div.classList.add("extension-candleappstore-flex");
                                        permission_div.classList.add('extension-candleappstore-settings-permission-setting');
                                        permission_div.classList.add('extension-candleappstore-settings-enum');
                                        
                                        
                                        
                                        //d.appendChild(left);
                                        //d.appendChild(xs); // Append dropdown
                                        //d.classList.add("extension-candleappstore-flex");
                                        //d.classList.add('extension-candleappstore-settings-permission-setting');
                                        //d.classList.add('extension-candleappstore-settings-enum');
                                        //return;
                                        
                                        form.prepend(permission_div);
                                    }
                                    
                                }
                                else{
                                    
                                    // Detected an object
                                    if( addon_settings_props[info]['type'] == 'object'){
                                        //console.log("OBJECT setting spotted. checked = " + data[info]);
                                    }
                                    if( addon_settings_props[info]['type'] == 'array'){
                                        //console.log("ARRAY setting spotted. checked = " + data[info]);
                                    }
                                    
                                    //console.log("This addon has a complex object in its settings. Creating redirect button. type: ", addon_settings_props[info]['type']);
                                    form.innerHTML = '<p>This addon has some complicated settings. Click the button below to close the Candle app store and change your preferences via the system settings instead.</p><a href="/settings/addons/config/' + addon_id + '"><button class="extension-candleappstore-button">Click here to change settings</button></a>';
                                    document.getElementById('extension-candleappstore-settings-options').style.display = 'none';
                                    
                                    stop_processing = true;
                                    return false;
                                }
                        
                    
                            }
                            catch(e){
                                console.log("Error populating selected: " + e);
                            }
                            


                    
                            //console.log("advanced = " + advanced);
                            //console.log("is_required = " + is_required);
                            // split new settings items between normal and advanced area
                            if( advanced && !is_required){
                                //spotted_advanced_setting = true;
                                advanced_form.appendChild(d);
                                if(!info.toLowerCase().startsWith('debug') || this.developer == true){
                                    advanced_form_container.style.display = "block";
                                }
                            }
                            else{
                                form.appendChild(d);
                            }
                    
                    
                        }); // end of looping over settings
                        
                
                        // ADD SETTINGS SAVE BUTON
                        var b = document.createElement("button");
                        b.classList.add('extension-candleappstore-settings-save-button');
                        b.classList.add('extension-candleappstore-button');
                        var t = document.createTextNode("Save");
                        b.appendChild(t);
        				b.addEventListener('click', (event) => {
                            //console.log("settings save button clicked");
                            //console.log(event);
                            event.stopImmediatePropagation();
                            
                            if(this.exhibit_mode){
                                console.log("Cannot change settings while in exhibit mode");
                                alert("Sorry, cannot change settings while in exhibit mode");
                                return;
                            }
                            
                            //const addon_id = data[i]["addon_id"];
                    
                            // extract new settings
                            var missing_value = false;
                            var new_data = {};
                            settings_keys.forEach((info, index) => {
                                //console.log("EXTRACTING SETTING ITEM: ", info);
                    
                                const css_element_id = 'extension-candleappstore-settings-setting-' + this.makeSafeForCSS(info);
                                //console.log("target element id: --" + css_element_id + '--');
                                var target_element = document.getElementById( css_element_id );
                                //console.log("target_element: ", target_element);
                                //console.log("setting extraction target element:");
                                //console.log(target_element);
                        
                                try{
                                    if(this.debug){
                                        console.log("addon_settings_props[info]['type']: ", addon_settings_props[info]['type']);
                                    }
                                    //if( typeof info == "boolean" ){
                                    if( addon_settings_props[info]['type'] == 'boolean'){                                
                                        new_data[info] = target_element.checked;
                            
                                    }
                                    
                                    else if( addon_settings_props[info]['type'] == 'number'){
                                        var value = parseFloat(target_element.value);
                                        if(this.debug){
                                            console.log("number value: ", value);
                                        }
                                        if( target_element.required && isNaN(value) ){
                                            if(this.debug){
                                                console.log("Warning, required number value was not filled: ", value);
                                            }
                                            missing_value = true;
                                            target_element.classList.add("extension-candleappstore-settings-empty-warning"); 
                                        }
                                        new_data[info] = value;
                                        
                                    }
                                    
                                    else if( addon_settings_props[info]['type'] == 'range'){
                                        var value = parseFloat(target_element.value);
                                        if(this.debug){
                                            console.log("range value: ", value);
                                        }
                                        new_data[info] = value;
                                    }
                                    
                                    else{
                                        var value = target_element.value;
                                        if(this.debug){
                                            console.log("fell through, likely a string type");
                                            console.log(addon_settings_props[info]['type'] + " value: ", value);
                                        }
                                        // If the background color is black, set the background to none.
                                        if(css_element_id == 'extension-candleappstore-settings-setting-backgroundcolor'){
                                            //console.log("checking color value: ", value);
                                            if(value == '#000000' || value == '#ffffff'){
                                                //console.log('setting background color from black to none');
                                                value = "";
                                            }
                                        }
                                        
                                        if( target_element.required && value == "" ){
                                            if(this.debug){
                                                console.log("Warning, required value was not filled");
                                            }
                                            missing_value = true;
                                            target_element.classList.add("extension-candleappstore-settings-empty-warning"); 
                                        }
                                        new_data[info] = value;

                                    }
                           
                                    //console.log("new_data[info] = " + new_data[info]);
                    
                                }
                                catch(e){
                                    console.log("Error extracting setting value: " + e);
                                }
                    
                            });
                    
                            if(missing_value == false){
                        
                                //console.log("WILLL SAVE NEW ADDONS SETTINGS:");
                                //console.log(new_data);
                        
                                settings_container.classList.add("extension-candleappstore-busy");
                                if(this.developer == false){
                                    document.getElementById('connectivity-scrim').classList.remove('hidden');
                                }
                                
                                if(this.debug){
                                    console.log("saving config for: ", addon_id);
                                    console.log("new config data: ", new_data);
                                }
                                //window.API.setAddonConfig( addon_id, JSON.stringify(new_data) )
                                window.API.setAddonConfig( addon_id, new_data )
                                .then(() => { 
            						if(this.debug){
                                        console.log("saved settings result for addon: " + addon_id);
                                    }
                                    
                                    setTimeout(function(){
                                        window.location.reload(true); // harsh, but no UI's without backends this way.
                                    }, 3000);
                                    
                                    /*
                                    setTimeout(function(){
                                        document.getElementById("extension-candleappstore-settings").style.display = 'none';
                                    }, 2000);
                                    
                                    setTimeout(function(){
                                        document.getElementById("extension-candleappstore-settings").style.display = 'none';
                                    }, 5000);
                                    */
                                    
            					}).catch((e) => {
            						console.log("setAddonConfig catch (error?): ", e);
                                    document.getElementById("extension-candleappstore-settings").style.display = 'none';
                                    document.getElementById('connectivity-scrim').classList.add('hidden');
                                    alert("There was a connection error while saving the settings.");
            					});
                        
                            }
                            else{
                                alert("A required value was not filled in and/or selected");
                            }
                    
                    

                        });
                
                
                        settings_options_bar.appendChild(b);
                    
            
    				})
                    .catch((e) => {
    					console.log("get addon config catch (error?): ", e);
    					//alert("Error, could not load setting, sorry.");
    				});
				})
                .catch((e) => {
					console.log("get addons overview error: ", e);
				});
                
                // get a z-index above the main menu button while overlay with back button is active
                document.getElementById('extension-candleappstore-view').style.zIndex = '3';
                
                
            }
            catch(e){
                console.log("Error in show_addon_config: " + e);
            }
            
        }
        
        
        
        

        
        
        //
        //  sort items in various ways
        //
        
        sort_items(type){
            //console.log("in sort_items. Type = " + type);
            const sortChildren = ({ container, childSelector, getScore }) => {
              const items = [...container.querySelectorAll(childSelector)];

              items
                .sort((a, b) => getScore(b) - getScore(a))
                .forEach(item => container.appendChild(item));
            };
            
            if(type == 'count'){
                //console.log("sort type is count");
                
                document.querySelectorAll('.extension-candleappstore-domains').forEach(function(node) {
                    //console.log(node);
                    sortChildren({
                      container: node,
                      childSelector: ".extension-candleappstore-domain-item",
                      getScore: item => {
                        const rating = item.querySelector(".extension-candleappstore-domain-count");
                        //console.log("rating element:")
                        //console.log(rating)
                        if (!rating) return 0;
                        //const scoreString = [...rating.classList].find(c => /r\d+/.test(c)); // based on classnames
                        //const scoreString = [...rating.innerText]; //.find(c => /r\d+/.test(c));
                        //console.log("scoreString = " + scoreString);
                        //const score = parseInt(scoreString.slice(1));
                        //const score = parseInt(scoreString);
                        //return score;
                        return parseInt(rating.innerText)
                      }
                    });
                });
                
            }

        }
        
        
        makeSafeForCSS(name) {
            /*
            return name.replace(/[^a-z0-9]/g, function(s) {
                var c = s.charCodeAt(0);
                if (c == 32) return '-';
                if (c >= 65 && c <= 90) return '_' + s.toLowerCase();
                return '__' + ('000' + c.toString(16)).slice(-4);
            });
            */
            name = name.toLowerCase();
            return name.replace(/[^a-z0-9_]/g,"");
        }
        
        
        
        string_to_color(str, options) {

            // Generate a Hash for the String
            this.hash = function(word) {
                var h = 0;
                for (var i = 0; i < word.length; i++) {
                    h = word.charCodeAt(i) + ((h << 5) - h);
                }
                return h;
            };

            // Change the darkness or lightness
            this.shade = function(color, prc) {
                var num = parseInt(color, 16),
                    amt = Math.round(2.55 * prc),
                    R = (num >> 16) + amt,
                    G = (num >> 8 & 0x00FF) + amt,
                    B = (num & 0x0000FF) + amt;
                return (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                    (B < 255 ? B < 1 ? 0 : B : 255))
                    .toString(16)
                    .slice(1);

            };
    
            // Convert to an RGBA
            this.int_to_rgba = function(i) {
                var color = ((i >> 24) & 0xFF).toString(16) +
                    ((i >> 16) & 0xFF).toString(16) +
                    ((i >> 8) & 0xFF).toString(16) +
                    (i & 0xFF).toString(16);
                return color;
            };

            return this.shade(this.int_to_rgba(this.hash(str)), -30);

        }
        
        
        
        
	}
    
    
    
    function linkify(string, output_domains){ // output_domains should be a boolean. If false it shows LINK, otherwise the domain as the link text
        //console.log("linkify: output_domains: ", output_domains);
        
        var show_domains = false;
        if ( typeof output_domains !== 'undefined' ){
            show_domains = output_domains;
        }
        
        string = string.replace('(gateway >= 0.9.0 only)', '');
        
        // URL's
        var urls = string.match(/(((ftp|https?):\/\/)[\-\w@:%_\+.~#?,&\/\/=]+)/g);
        if (urls) {
            urls.forEach(function (url) {
                var link_text = "LINK";
                if(show_domains){
                    link_text = url.replace('http://','').replace('https://','').replace('www.','').split(/[/?#]/)[0];
                    //console.log("urlParts: ", urlParts);
                    //link_text = urlParts[0];
                }
                string = string.replace(url, '<a target="_blank" href="' + url + '">' + link_text + "</a>");
            });
        }
        
        // Email addresses
        var replacePattern3 = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;
        string = string.replace(replacePattern3, '<a href="mailto:$1">EMAIL</a>');
        
        return string; //.replace("(", "<br/>(");
    }
    
    /*
    function linkify(inputText) {
        
        inputText = inputText.replace('(gateway >= 0.9.0 only)', '');
        
        var replacedText, replacePattern1, replacePattern2, replacePattern3;

        //URLs starting with http://, https://, or ftp://
        replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
        replacedText = inputText.replace(replacePattern1, '<a href="$1" target="_blank">LINK</a>');

        //URLs starting with "www." (without // before it, or it'd re-link the ones done above).
        replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
        replacedText = replacedText.replace(replacePattern2, '$1<a href="http://$2" target="_blank">LINK</a>');

        //Change email addresses to mailto:: links.
        replacePattern3 = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;
        replacedText = replacedText.replace(replacePattern3, '<a href="mailto:$1">EMAIL</a>');

        return replacedText;
    }
    */
	new Candleappstore();
	
})();


