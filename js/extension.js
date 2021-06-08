(function() {
	class Candleappstore extends window.Extension {
	    constructor() {
	      	super('candleappstore');
			console.log("Adding candleappstore addon to menu");
      		
			this.addMenuEntry('Candle App Store');
	
            //const page = require('page');
            //console.log(page);
    
	      	this.content = '';
            
            this.apps_overview = {};
            this.installed = []; // has data about folders in the addons folder. Comes from app store addon, and is then updated if addons are installed or uninstalled.
            this.app_data = []; // list of available apps, comes from the web via app store addon. #TODO: buffer this data locally to protect privacy
            this.api_addons_data = []; // has data about the settings of all addons, comes from gateway API.
            this.extensions = []; // holds all the data about installed addons data that extend the UI (css and js files)
            this.extensions_list = [];
            this.selector = "";
            this.username = "";
            this.permissions = {};
            
			fetch(`/extensions/${this.id}/views/content.html`)
	        .then((res) => res.text())
	        .then((text) => {
	         	this.content = text;
	  		 	if( document.location.href.endsWith("candleappstore") ){
					//console.log(document.location.href);
	  		  		this.show();
	  		  	}
	        })
	        .catch((e) => console.error('Failed to fetch content:', e));
            
            /*
            window.location.prototype.changed = function(e){};

            (function() //create a scope so 'location' is not global
            {
                var location = window.location.href;
                setInterval(function()
                {
                    if(location != window.location.href)
                    {
                        location = window.location.href;
                        window.location.changed(location);
                    }
                }, 1000);
            })();

            window.location.changed = function(e)
            {
                console.log(e);//outputs http://newhref.com
                //this is fired when the window changes location
            }
            */
            
            if( window.location.href == window.origin + '/settings/addons'){
                //window.location.href = window.origin + '/extensions/candleappstore';
            }
            
            
            var oldHref = document.location.href;

            var bodyList = document.querySelector("body");
            let observer = new MutationObserver(function(mutations) {
                console.log("muta");
                mutations.forEach(function(mutation) {
                    if (oldHref != document.location.href) {
                            oldHref = document.location.href;
                            
                            console.log("new location spotted via mutation observer");
                            const addons_page_url = window.origin + '/settings/addons';
                            const app_store_url = window.origin + '/extensions/candleappstore';
                            const base_url = window.location.protocol + "//" + window.location.host + '/settings/addons/config/';
                            if(oldHref == addons_page_url){
                                console.log("on addons overview page");
                                //window.location.href = app_store_url;
                            }
                        }

                    });

                });

            var config = {
                childList: true,
                subtree: true
            };

            observer.observe(bodyList, config);
            console.log("created mutation observer");
            
            /*
            window.addEventListener('popstate',()=>{
                //window.dispatchEvent(new Event('locationchange'));
                console.log("pop state location changed");
            });
            */
            
            /*
            var oldLocation = location.href;
            setInterval(function() {
                 if(location.href != oldLocation) {
                     // do your action
                     oldLocation = location.href;
                     console.log("URL changed");
                 }
             }, 1000); // check every second
            */
            
             
            /*
            window.onpopstate = function(event) {
              console.log("APPSTORE NEW location: " + document.location + ", state: " + JSON.stringify(event.state));
            };
            
            window.addEventListener('hashchange', function(e){console.log('hash changed')});
            
            window.onhashchange = function() {
                console.log("location changed");
            };
            */
            
            window.API.getAuthorizations()
            .then((result) => { 
				console.log("getAuthorizations result: ");
				console.log(result);
			}).catch((e) => {
				console.log("getAuthorizations catch (error?)");
                console.log(e);
			});
            

            
            
            
            
	    }

        /*
        get_installed_addons_data(){
            window.API.getInstalledAddons()
            .then((result) => { 
				console.log("get API getInstalledAddons info result: ");
				console.log(result);
                this.api_addons_data = result;
			}).catch((e) => {
				console.log("get getInstalledAddons info catch (error?)");
                console.log(e);
				pre.innerText = e.toString();
			});
        }
        */
		

		hide() {
			console.log("candleappstore hide called");
			try{
				clearInterval(this.interval);
				console.log("interval cleared");
			}
			catch(e){
				console.log("no interval to clear? " + e);
			}
		}
		

	    show() {
			//console.log("candleappstore show called");
			//console.log("this.content:");
			//console.log(this.content);
            console.log("Window: ");
            console.log(window);
            console.log("API: ");
            console.log(window.API);
            //console.log(window.API.getInstalledAddons());
            //console.log(window.API.getAddonConfig("airport"));
            //console.log(window.API.uninstallAddon);
            //window.API.uninstallAddon("bla");
            
            const main_view = document.getElementById('extension-candleappstore-view');

            
			try{
				clearInterval(this.interval);
			}
			catch(e){
				console.log("no interval to clear?: " + e);
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
                         console.log(xobj.responseText);
                         //callback(xobj.responseText);
                     }
               };
               xobj.send(null);  
            }
            console.log("attempting to load json");
            loadJSON();
			*/
            
			if(this.content == ''){
				return;
			}
			else{
				//document.getElementById('extension-candleappstore-view')#extension-candleappstore-view
				main_view.innerHTML = this.content;
			}
			
            this.get_installed_addons_data();
            
            window.API.getExtensions()
            .then((result) => { 
				console.log("getExtensions result: ");
				console.log(result);
                this.extensions = result;
                this.extensions_list = Object.keys(result);
			}).catch((e) => {
				console.log("getExtensions catch (error?)");
                console.log(e);
			});
            
			
			const list = document.getElementById('extension-candleappstore-list');
			const pre = document.getElementById('extension-candleappstore-response-data');
            const installed_list = document.getElementById('extension-candleappstore-installedlist');
            const selected = document.getElementById('extension-candleappstore-selected');
            const settings = document.getElementById('extension-candleappstore-settings');
            const selected_close_button = document.getElementById('extension-candleappstore-selected-close-container');
            const settings_close_button = document.getElementById('extension-candleappstore-settings-close-container');
            const auth_close_button = document.getElementById('extension-candleappstore-auth-close-container');
            
            //console.log("installedlist:");
            //console.log(installedlist);
            
            
            
			selected_close_button.addEventListener('click', (event) => {
                console.log("Selected app close button clicked");
                selected.style.display = 'none';
			});
            
			settings_close_button.addEventListener('click', (event) => {
                console.log("Settings close button clicked");
                settings.style.display = 'none';
			});
            
			auth_close_button.addEventListener('click', (event) => {
                console.log("Auth close button clicked");
                auth.style.display = 'none';
			});
            
            
            
            
            const auth = document.getElementById('extension-candleappstore-auth');
            
            const login_form = document.getElementById('extension-candleappstore-auth-login-form');
            const signup_form = document.getElementById('extension-candleappstore-auth-signup-form');
            const verify_form = document.getElementById('extension-candleappstore-auth-verify-form');
            
            
            const review_container = document.getElementById('extension-candleappstore-review-container');
            
            const auth_response = document.getElementById('extension-candleappstore-auth-response');
            const review_response = document.getElementById("extension-candleappstore-review-response")
            
            const username = document.getElementById('extension-candleappstore-username');
            const check_login_button = document.getElementById('extension-candleappstore-check-login-button');
            const logout_container = document.getElementById('extension-candleappstore-logout');
            
            const login_button = document.getElementById('extension-candleappstore-login-button');
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
                console.log("logout button clicked");

                this.get_data('logout.php')
                .then(response => {
                    console.log("LOGOUT RESPONSE!");
                    console.log(response);
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
					console.log("candleappstore: error while test");
					pre.innerText = e.toString();
				});
                
            });
        
            
            check_login_button.addEventListener('click', (event) => {
                console.log("login button clicked");
                
                this.get_data('state.php')
                .then(response => {
                    console.log("STATE RESPONSE!");
                    console.log(response);
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
					console.log("candleappstore: error while test");
					pre.innerText = e.toString();
				});
            });
            
            
            login_button.addEventListener('click', (event) => {
                console.log("login button clicked");
                
                const email = document.getElementById('extension-candleappstore-login-email').value;
                const password = document.getElementById('extension-candleappstore-login-password').value;
                
                if(email != "" && password != ""){
                    
                    const login_data = {
                        'email':email,
                        'password':password
                    }
                
                    // Get data for apps overview
                    this.get_data("login_json.php",login_data).then(response => {
                        console.log("LOGIN RESPONSE!");
                        console.log(response);
                        console.log("typeof response = " + typeof response);
                        
                        if(response.hasOwnProperty('username')){
                            console.log("username spotted");
                            this.username = response['username'];
                            document.getElementById("extension-candleappstore-username").innerText = response['username'];
                            //logout_button.style.display = 'block';
                            //login_form.style.display = 'none';
                        }
                        if(response.hasOwnProperty('ok')){
                            console.log("ok in response");
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
            
            
            
            show_signup_button.addEventListener('click', (event) => {
                console.log("show signup button clicked");
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
                console.log("signup_beta_checkbox.checked = " + signup_beta_checkbox.checked);
			});
            
            
            
            signup_button.addEventListener('click', (event) => {
                console.log("signup button clicked");
                
                const username = document.getElementById('extension-candleappstore-signup-username').value;
                const email = document.getElementById('extension-candleappstore-signup-email').value;
                const password = document.getElementById('extension-candleappstore-signup-password').value;
                const cpassword = document.getElementById('extension-candleappstore-signup-cpassword').value;
                const beta = signup_beta_checkbox.checked;
                const github_username = document.getElementById('extension-candleappstore-github-username').value;
                
                if(password == cpassword){
                    
                    const register_data = {
                        'username':username,
                        'email':email,
                        'password':password,
                        'beta':beta,
                        'github_username':github_username
                    }
                
                    // Get data for apps overview
                    this.get_data("signup_json.php",register_data).then(response => {
                        console.log("SIGNUP RESPONSE!");
                        console.log(response);
                        console.log("typeof response = " + typeof response);
                        if(response.hasOwnProperty('selector')){
                            this.selector = response['selector'];
                            signup_form.style.display = 'none';
                            verify_form.style.display = 'block';
                        }
                        else  if(response.hasOwnProperty('error')){   
                            auth_response.innerText = response['error'];
                        }
                        
                    });
                    
                }
                else{
                    alert("The passwords didn't match");
                }
                
			});
            
            
            
            verify_button.addEventListener('click', (event) => {
                console.log("verify button clicked");
                
                const code = document.getElementById('extension-candleappstore-verify-code').value;
                
                if(code != ""){
                    this.get_data('verify_json.php?selector=' + this.selector + '&token=' + code ).then(response => {
                        console.log("VERIFY RESPONSE!");
                        console.log(response);
                        console.log("typeof response = " + typeof response);
                        if(response.hasOwnProperty('ok')){
                            verify_form.style.display = 'none';
                            login_form.style.display = 'block';
                            auth_response.innerText = response['ok'];
                            auth.style.display = 'none';
                            if(response.hasOwnProperty('username')){
                                username.innerText = response['username'];
                                logout_container.style.display = 'inline-block';
                                login_button.style.display = 'none';
                            }
                        }
                        else if(response.hasOwnProperty('error')){
                            console.log("Error verifying token");
                            auth_response.innerText = response['error'];
                        }
                    
                    });
                }
                else{
                    alert("Please enter the verification code first");
                }
                
			});
            
            // SHOW REVIEW CONTAINER
            document.getElementById("extension-candleappstore-show-review-button").addEventListener('click', (event) => {
                console.log("show review container button clicked");
                review_container.style.display = "block";
            });
            
            
            // SAVE REVIEW
            review_save_button.addEventListener('click', (event) => {
                console.log("review save button clicked");
                
                review_response.innerHTML = "";
                auth_response.innerHTML = "";
                
                if(review_rating_select.value != -1){
                    
                    var parameters = {"rating":review_rating_select.value};
                    if(review_risk_select.value != -1){
                        parameters['risk'] = review_risk_select.value;
                    }
                    if(review_text.value != ""){
                        parameters['review'] = review_text.value;
                    }
                    
                    parameters['mayor_version'] = document.getElementById("extension-candleappstore-selected-mayor_version").innerText;
                    parameters['meso_version'] = document.getElementById("extension-candleappstore-selected-meso_version").innerText;
                    parameters['minor_version'] = document.getElementById("extension-candleappstore-selected-minor_version").innerText;
                    
                    parameters['addon_id'] = selected.getAttribute('data-addon-id');
                    
                    console.log(parameters);
                    const url = "rate.php";
                    console.log(url);
                    
                    this.get_data(url, parameters)
                    .then(response => {
    					console.log("ADD RATING response: ");
    					console.log(response);
                        if(response.hasOwnProperty('error')){
                            review_response.innerText = response['error'];
                        }
                        if(response.hasOwnProperty('ok')){
                            review_complete.innerText = response['ok'];
                            review_complete.style.display = 'block';
                            review_container.style.display = 'none';
                        }
                        if(response.hasOwnProperty('action')){
                            console.log("action spotted: " + response['action']);
                            if(response['action'] == "login"){
                                console.log("do action");
                                login_form.style.display = "block";
                                signup_form.style.display = "none";
                                auth.style.display = "block";
                                document.getElementById("extension-candleappstore-auth-intro").innerText = "To rate apps you will need an account.";
                                login_form.style.display = "block;"
                            }
                        }
                    })
                    .catch((e) => {
    					console.log("candleappstore: error while saving rating");
    					pre.innerText = e.toString();
    				});
                }
                
			});
            
            
            // CANCEL REVIEW
            review_cancel_button.addEventListener('click', (event) => {
                console.log("review cancel button clicked");
                review_container.style.display = "none";
            });
            
            

            
            
            
            
            // Useful info about the system and what addons it may be able to install
            /*
            window.API.getAddonsInfo()
            .then((result) => { 
				console.log("get addons info result: ");
				console.log(result);
			}).catch((e) => {
				console.log("get addons info catch (error?)");
                console.log(e);
				pre.innerText = e.toString();
			});
            */
            
            
            

            
            
            
            
			/*
			document.getElementById('extension-candleappstore-refresh-button').addEventListener('click', (event) => {
				//console.log("refresh button clicked");
				//this.get_latest();
                
                console.log("GRABBING JSON VIA ADDON");
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
                    console.log("crash and burn");
                });
                
			});
            */
            
            // Get data for apps overview
            this.get_data("get_apps.php").then(response => {
                console.log("GET ALL APPS response:");
                console.log(response);
                
                //const parsed = JSON.parse(response);
                //this.app_data = parsed;
                this.app_data = response;
                //console.log(parsed);
                this.generate_overview(); 
            })
            .catch((e) => {
				console.log("candleappstore: could not get data for apps overview");
				pre.innerText = "Could not get latest apps data! " + e.toString();
			});
            
            
            
            
            //
            // INIT
            //
			window.API.postJson(
				`/extensions/candleappstore/api/ajax`,
				{'action':'init'}
			).then((body) => { 
				console.log("INIT response: ");
				console.log(body);
				if( body['state'] != true ){
					pre.innerText = body['message'];
				}
                else{
                    this.app_store_url = body['app_store_url'];
                    this.installed = body['installed'];
                    this.permissions = body['permissions'];
                    //this.generate_installed( body['installed'] );
                }

			}).catch((e) => {
				console.log("candleappstore: error in init");
				pre.innerText = e.toString();
			});
            
            
            
            /*
            this.get_data("https://www.candlesmarthome.com/appstore/get_apps.php")
            .then(function(result) {
                console.log("IN THEN. This:");
                console.log(this);
                const parsed = JSON.parse(result);
                console.log(parsed);
                this.generate_overview( parsed ); 
                
              //return doSomethingElse(result);
            })
            //.then(function(newResult) {
              //return doThirdThing(newResult);
            //})
            //.then(function(finalResult) {
            //  console.log('Got the final result: ' + finalResult);
            //})
            .catch(function(result) {
                console.log("get_data crash and burn:");
                console.log(result);
            });
            */
        
            
            
            /*
            
            // Abort button
			document.getElementById('extension-candleappstore-abort-button').addEventListener('click', (event) => {
				//console.log("abort button clicked");
				
                
		        window.API.postJson(
		          `/extensions/candleappstore/api/ajax`,
					{'action':'abort'}

		        ).then((body) => {
					//console.log("abort response:");
                    //console.log(body);
                    this.aborted = true;
                    document.getElementById('extension-candleappstore-abort-message').innerText = "Launch was aborted ";
                    
		        }).catch((e) => {
		  			console.log("Error sending abort command: " + e.toString());
					document.getElementById('extension-candleappstore-abort-message').innerText = "Error sending abort command: " + e.toString();
		        });
                
			});
			*/
            
                
            // Launch button
            /*
			document.getElementById('extension-candleappstore-launch-button').addEventListener('click', (event) => {
				//console.log("launch button clicked");
                
		        window.API.postJson(
		          `/extensions/candleappstore/api/ajax`,
					{'action':'launch'}

		        ).then((body) => {
					//console.log("launch now response:");
                    //console.log(body);
                    this.aborted = true;
                    document.getElementById('extension-candleappstore-abort-message').innerText = "Launching...";
                    this.seconds = 89;
                    
		        }).catch((e) => {
		  			console.log("Error sending abort command: " + e.toString());
					document.getElementById('extension-candleappstore-abort-message').innerText = "Error sending abort command: " + e.toString();
		        });
                
			});
            */
                
            
            // Listen for changes in dropdowns
            /*
            main_view.addEventListener('change', function(event) {
                //console.log(event);
                if (event.target.tagName.toLowerCase() === 'select') {
                  //console.log("clicked on select. value: " + event.target.value);
                  const target = event.target;
                  
  				window.API.postJson(
  					`/extensions/candleappstore/api/ajax`,
  					{'action':'set_permission','domain':target.dataset.domain, 'permission':target.value, 'mac':target.dataset.mac}
  				).then((body) => { 
  					//console.log("update permission reaction: ");
  					//console.log(body); 
  					if( body['state'] != true ){
  						pre.innerText = body['message'];
  					}

  				}).catch((e) => {
  					//console.log("candleappstore: error in dropdown permissions handler");
  					pre.innerText = e.toString();
  				});
                  
              }
              else if (event.target.tagName.toLowerCase() === 'option') {
                  //console.log("clicked on option");
              }
            });
                
            */
                
                
            // Listen for remove buttons clicks in installedlist
            /*
            installedlist.addEventListener('click', function(event) {
              //console.log(event);
              if (event.target.tagName.toLowerCase() === 'button') {
                  //const classes = event.target.classList;
                  //if( classes.indexOf("extension-candleappstore-installedlist-remove-button") >= 0 ){
                      
                  if( event.target.innerText == 'unblock'){
                      //console.log("clicked on unblock button.");
                      
                      const target = event.target;
                  
                      //console.log("removing: " + target.dataset.domain);
                      
        				window.API.postJson(
        					`/extensions/candleappstore/api/ajax`,
        					{'action':'remove_from_master_installedlist','domain':target.dataset.domain}
        				).then((body) => { 
        					//console.log("remove from installedlist reaction: ");
        					//console.log(body); 
        					if( body['state'] != true ){
        						pre.innerText = body['message'];
                            }
                            else{
                                //console.log("should remove from list: " + target.dataset.domain);
                                //this.get_latest();
                                
                                const installedlist_children = document.getElementById("extension-candleappstore-installedlist").children;
                                for (var i = 0; i < installedlist_children.length; i++) {
                                  var child = installedlist_children[i];
                                  if( child.dataset.domain == target.dataset.domain ){
                                      document.getElementById("extension-candleappstore-installedlist").removeChild(child);
                                  }
                                }
                            }

        				}).catch((e) => {
        					console.log("candleappstore: error in remove from installedlist handler");
        					pre.innerText = e.toString();
        				});
                  }
                  
                  
                  
              }
            });
            */
            
		
		    /*
			this.interval = setInterval(function(){
				//this.get_latest();
                
                this.seconds++;
                //console.log(this.seconds);
                
                if(this.seconds < 90 && this.aborted == false){
                    document.getElementById('extension-candleappstore-countdown-seconds').innerText = 90 - this.seconds;
                    document.getElementById('extension-candleappstore-countdown').classList = ['extension-candleappstore-visible'];
                }
                else{
                    document.getElementById('extension-candleappstore-countdown').classList = ['extension-candleappstore-hidden'];
                    if(this.launched == false){
                        this.launched = true;
                        this.regenerate_items();
                    }
                }
			}.bind(this), 1000);
			*/
            
            //this.get_latest();


			// TABS

			document.getElementById('extension-candleappstore-tab-button-timers').addEventListener('click', (event) => {
				document.getElementById('extension-candleappstore-content').classList = ['extension-candleappstore-show-tab-timers'];
			});
			document.getElementById('extension-candleappstore-tab-button-satellites').addEventListener('click', (event) => {
				document.getElementById('extension-candleappstore-content').classList = ['extension-candleappstore-show-tab-satellites'];
			});
			document.getElementById('extension-candleappstore-tab-button-tutorial').addEventListener('click', (event) => {
				document.getElementById('extension-candleappstore-content').classList = ['extension-candleappstore-show-tab-tutorial'];
			});

		}
		
	
		/*
		hide(){
			clearInterval(this.interval);
			this.view.innerHTML = "";
		}
		*/
        
        // Ask python to request some app server data
        get_data = (url, parameters) =>
        {
            const pre = document.getElementById('extension-candleappstore-response-data');
            //console.log(this);
            return new Promise((myResolve, myReject) =>
            {
                console.log("url = " + url);
                console.log("parameters = " + parameters);
                
                //console.log(this);
                
    	        window.API.postJson(
    	            `/extensions/${this.id}/api/ajax`,
    			    {'action':'get_json','url':url,'parameters':parameters}

    	        ).then((body) => {
    				console.log("Python API /get_json result:");
    				console.log(body);
                
    				if(body['state'] == true){
                        pre.innerText = body['message'];	
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
    				console.log("Error: " + e);
    				pre.innerText = "getting json failed - connection error?";
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
    				console.log("get API getInstalledAddons info result: ");
    				console.log(result);
                    this.api_addons_data = result;
                    myResolve();
    			}).catch((e) => {
    				console.log("get getInstalledAddons info catch (error?)");
                    console.log(e);
    				pre.innerText = e.toString();
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
    				console.log("Python API remember permission result:");
    				console.log(body);
                
    				if(body['state'] == true){
                        pre.innerText = body['message'];
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
    				console.log("Error: " + e);
    				pre.innerText = "remembering permission failed - connection error?";
    				//return {};
                    myReject({});
    	        });	
            });
        };
        
        
        
        
    
        //
        //  GENERATE OVERVIEW
        //
    
        generate_overview(){
            try{
                const data = this.app_data; // this is data from the appstore serer
                console.log("in generate_overview");
    			const pre = document.getElementById('extension-candleappstore-response-data');
    			const list = document.getElementById('extension-candleappstore-list');
    			//const original = document.getElementById('extension-candleappstore-original-item');
                const original_basic_item = document.getElementById('extension-candleappstore-original-item');
                const installed_list = document.getElementById('extension-candleappstore-installedlist');
                const settings_container = document.getElementById('extension-candleappstore-settings');
                
                console.log("extensions: ");
                console.log(this.extensions_list);
            
                //
                //  UPDATE ADDONS
                //
                
                list.innerHTML = "";
                installed_list.innerHTML = "";
                console.log("addon count: " + data.length);
                
                
                this.get_installed_addons_data()
                .then(() => { 
                    
                    for(let i = 0; i < data.length; i++){
                        //console.log("generating: " + data[i].name);

                        // Get the data about this addon from the gateway API as well
                        var api_data = null;
                        for(let u= 0; u < this.api_addons_data.length; u++){
                            if( this.api_addons_data[u]['id'] == data[i].addon_id ){
                                api_data = this.api_addons_data[u];
                                //console.log("found api_data");
                                //console.log(api_data);
                                //break;
                            }
                        }
                    
                        // Create clone
                        var clone = original_basic_item.cloneNode(true);
                        clone.removeAttribute('id');
                        clone.setAttribute('data-addon-id', data[i].addon_id);
                        clone.style.background = "#" + this.string_to_color(data[i].addon_id);
                    
                    
                        // Check if this addon is a UI extension
                        var ui_extension = false
                        if(this.extensions_list.indexOf(data[i]["addon_id"]) != -1){
                            console.log("-This addon is a UI extension");
                            ui_extension = true;
                            clone.setAttribute('data-extension', 1);
                        }
                        
                    
                        const keys = Object.keys(data[i]);
                    
    					keys.forEach((info, index) => {
                            //console.log(info);
                        
                        
                            if(info == 'name' || info == 'description'){
                            
                                //var s = document.createElement("span");
                                //s.classList.add('extension-candleappstore-nice-name-span');      
                                var t = document.createTextNode(data[i][info]);
                                //s.appendChild(t);
                            
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
                          
                            console.log(event);
                        
                            event.stopImmediatePropagation();
                        
                            //target.dataset.domain
                            const selected = document.getElementById('extension-candleappstore-selected');
                            selected.style.display = 'block';
                            document.getElementById("extension-candleappstore-review-container").style.display = "none";
                            document.getElementById('extension-candleappstore-review-complete').style.display = "none";
                        
    						var target = event.currentTarget;
                            console.log(target);
                        
                        
                        
    						//var parent3 = target.parentElement.parentElement.parentElement;
    						//parent3.classList.add("delete");
    						//var parent4 = parent3.parentElement;
    						//parent4.removeChild(parent3);
    	                    console.log(target.dataset);
                            //console.log("addon_id = " + target.dataset['addon-id']);
                            //const url = "get_addons.php?addon_id=" + target.dataset.addon_id;
                            const addon_id = target.getAttribute('data-addon-id');
                            const url = "get_app.php?addon_id=" + addon_id;
                            console.log(url);
                        
                            this.get_data(url)
                            .then(response => {
    							console.log("GET APP response: ");
    							console.log(response);
                                this.show_selected_app(addon_id, response, target.getAttribute('data-installed') ); // data, and whether it is installed already
                            })
                            .catch((e) => {
    							console.log("candleappstore: error while getting detailed data about an addon");
    							pre.innerText = e.toString();
    						});
                        

        				});
                    
                    

                    
        
                    
                    
                        if( this.installed.indexOf(data[i].addon_id) == -1 ){
                        
                            // not installed
                            clone.classList.add("installed");
                            clone.setAttribute('data-installed', 0);
                        
                            // wait, this doesn't work, since extension data is only available on installed addons.
                            if(ui_extension){
                                //console.log("-This addon is a UI extension");
                                list.insertBefore(clone, list.firstChild);
                            }else{
                                //console.log("-This addon is NOT a UI extension");
                                list.appendChild(clone); 
                            }
                        
                        
                        
                        }
                        else{
                        
                            //already installed, so add SETTINGS BUTTON (and then PLAY/PAUSE button)
                        
                            var b = document.createElement("button");
                            b.classList.add('extension-candleappstore-selected-settings-button');
                            b.classList.add('extension-candleappstore-button');
                            b.classList.add('addon-settings-config');
                            b.classList.add('text-button');
                            var t = document.createTextNode("Settings");
                            b.appendChild(t);
        					b.addEventListener('click', (event) => {
                                console.log("settings button clicked");
                                console.log(event);
                                event.stopImmediatePropagation();
                                console.log( data[i]["addon_id"] );
                            
                                // Show settings overlay
                                settings_container.style.display = 'block';
                                settings_container.classList.add("extension-candleappstore-busy");
                            
                                /*
        						window.API.postJson(
        							`/extensions/candleappstore/api/ajax`,
        							{'action':'get_manifest','addon_id': data[i]["addon_id"] }
        						).then((body) => { 
        							//console.log("clear item reaction: ");
        							//console.log(body);
        							if( body['state'] != true ){
        								pre.innerText = body['message'];
        							}
                                    else{
                                        this.show_selected_app(JSON.parse(body['body']), target.getAttribute('data-installed') ); // data, and whether it is installed already
                                    }

        						}).catch((e) => {
        							console.log("candleappstore: error in clear device handler");
        							pre.innerText = e.toString();
        						});
                                */
                            
                                //this.get_installed_addons_data();
                            
                                window.API.getAddonConfig( data[i]["addon_id"] )
                                .then((result) => { 
        							console.log("get addon config result: ");
        							console.log(result); 
                                    console.log(data[i]);
                                    document.getElementById("extension-candleappstore-settings-title").innerText = data[i]["name"];
                                    this.show_addon_config(data[i]["addon_id"], result);

        						}).catch((e) => {
        							console.log("get addon config catch (error?)");
                                    console.log(e);
        							pre.innerText = e.toString();
        						});
                            
                            
                            
                            
                            });
                            //console.log("adding settings button");
                            //document.getElementById("extension-candleappstore-selected-options").appendChild(b);
                        
                            clone.setAttribute('data-installed', 1);
                            var target_element = clone.querySelectorAll( '.extension-candleappstore-basic-options' )[0];
                            target_element.appendChild(b);
                            //installed_list.appendChild(clone);
                        
                        
                        
                        
                            // Add PLAY/PAUSE BUTTON to installed app
                            b = null;
                            t = null;
                            
                            console.log("ui_extension is now: " + ui_extension);
                            
                            b = document.createElement("button");
                            b.classList.add('extension-candleappstore-selected-playpause-button');
                            b.classList.add('extension-candleappstore-button');
                            
                            b.setAttribute('data-extension', ui_extension);
                            
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
                            }else{
                                console.log("WHOA, this addon had no api_data!");
                                t = document.createTextNode("error");
                                b.appendChild(t);
                            }
                        
                        
        					b.addEventListener('click', (event) => {
                                console.log("playpause button clicked");
                                console.log(event);
                                event.stopImmediatePropagation();
                                //if (event.target.tagName.toLowerCase() === 'label') {
                                console.log( data[i]["addon_id"] );
                            
                                var should_enable = null;
                                console.log(event.target.dataset.enabled);
                                if(event.target.dataset.enabled == 1){
                                    console.log("is enabled, so disabling now");
                                    should_enable = false;
                                }
                                else if(event.target.dataset.enabled == 0){
                                    console.log("is DISabled, so enabling now");
                                    should_enable = true;
                                }
                                if(should_enable != null){
                                    console.log("SWITCHING ADDON TO NEW STATE: " + should_enable);
                                    event.target.innerText = "busy";
                                    window.API.setAddonSetting( data[i]["addon_id"], should_enable)
                                    .then((result) => {
            							console.log("get addon play/pause result: ");
            							console.log(result);
                                        console.log("ui_extension = " + ui_extension);
                                        
                                        console.log("event.target.dataset.extension: " + event.target.dataset.extension );
                                        
                                        if(event.target.dataset.extension == "false"){
                                            console.log("false string");
                                        }
                                        if(event.target.dataset.extension == false){
                                            console.log("false as boolean");
                                        }
                                        
                                        if(result['enabled'] && event.target.dataset.extension == "true"){
                                            var really = confirm("The app will show up in the menu after you reload this page. Would you like to reload now?");
                                            if (really) {
                                                console.log("Should reload window");
                                                //window.location.reload(false);
                                                window.location.reload();
                                            }
                                        }
                                        this.generate_overview();
                                    

            						}).catch((e) => {
            							console.log("Error enabling/disabling addon");
                                        console.log(e);
                                        if(should_enable){
                                            event.target.innerText = "Start";
                                        }
                                        else{
                                            event.target.innerText = "Stop";
                                        }
            							pre.innerText = e.toString();
            						});
                                }
                                else{
                                    alert("There is something wrong with this app. You could try re-installing it.");
                                }
                            
                            
                                /*
                                window.API.getAddonConfig( data[i]["addon_id"])
                                .then((result) => { 
        							console.log("get addon config result: ");
        							console.log(result); 
                                    console.log(data[i]);
                                    document.getElementById("extension-candleappstore-settings-title").innerText = data[i]["name"];
                                    this.show_addon_config(data[i]["addon_id"], result);

        						}).catch((e) => {
        							console.log("get addon config catch (error?)");
                                    console.log(e);
        							pre.innerText = e.toString();
        						});
                                */
                            
                            
                            
                            });
                            //console.log("adding play/pause button");
                            //document.getElementById("extension-candleappstore-selected-options").appendChild(b);
                        
                            //clone.setAttribute('data-enabled', 1);
                            var target_element = clone.querySelectorAll( '.extension-candleappstore-basic-options' )[0];
                            target_element.appendChild(b);
                        
                            installed_list.appendChild(clone); 
                        
                        }
                    
                    
                    
                    } // end of for loop
                    
                    
                    
				})
                .catch(() => {
                    console.log("Error while regenerating overview after waiting for api to get updated data on installed addons");
				});
                
                
                
                
                
            }
			catch (e) {
				// statements to handle any exceptions
				console.log(e); // pass exception object to error handler
			}
        }
        
        
        
        
        //
        //  GENERATE INSTALLED
        //
        
        generate_installed(data){
            console.log("in generate installed");
            console.log(data);
            
			const pre = document.getElementById('extension-candleappstore-response-data');
			const list = document.getElementById('extension-candleappstore-list');
			//const original = document.getElementById('extension-candleappstore-original-item');
            const original_basic_item = document.getElementById('extension-candleappstore-original-item-installed');
            const installedlist = document.getElementById('extension-candleappstore-installedlist');
            
        }
        
        
        
        //
        //  SHOW SELECTED APP
        //
        
        show_selected_app(addon_id, data, installed){
            try{
                console.log("in show_selected_app");
                console.log(data);
                installed = !!Number(installed); // turn into boolean
                console.log("installed: " + installed);
                console.log("typeof installed: " + typeof installed);
                //console.log(data['body']);
                
                const pre = document.getElementById('extension-candleappstore-response-data');
                const selected = document.getElementById('extension-candleappstore-selected');
                const selected_options_bar = document.getElementById("extension-candleappstore-selected-options");
                
                selected.setAttribute('data-addon-id',addon_id);
                if(installed){
                    selected.classList.add('extension-candleappstore-installed');  
                }
                else{
                    selected.classList.remove('extension-candleappstore-installed');  
                }
                  
                //
                
                var i = 0;
                const keys = Object.keys(data['versions'][i]);
                
    			keys.forEach((info, index) => {
                    console.log(info);
                    
                    const element_id = 'extension-candleappstore-selected-' + this.makeSafeForCSS(info);
                    const selector_name = '.' + element_id;
                    
                    try{
                        
                        console.log("looking for element: " + selector_name);
                        var target_element = selected.querySelectorAll( selector_name )[0];
                    }
                    catch(e){
                        console.log("Unable to find matching '" + info + "' element in app details view: " + e);
                    }

                    
                    if(target_element == undefined){
                        console.log("skipping key, since no matching element was found");
                        return;
                    }
                    console.log("-target element found");
                    
                    if(data['versions'][i][info] != null){
                        console.log("-target intended content exists");
                        try{
                            if( info.endsWith("_url") ){
                                target_element.href = data['versions'][i][info];
                            }
                            else{
                                //var s = document.createElement("span");
                                //console.log("selector_name = " + selector_name);
                                //s.id = element_id;
                                //s.classList.add('extension-candleappstore-nice-name-span');      
                                var t = document.createTextNode(data['versions'][i][info]);
                                //s.appendChild(t);
                                target_element.innerHTML = "";
                                target_element.appendChild(t);
                            }
                        
                        }
                        catch(e){
                            console.log("Error popularing selected: " + e);
                        }
                    }
                    
                });
                
                selected_options_bar.innerHTML = "";
                
                // ADD INSTALL BUTTON
                if( !installed && data['versions'][i]["addon_id"] != undefined && data['versions'][i]["download_url"] != undefined && data['versions'][i]["checksum"] != undefined ){
                    var b = document.createElement("button");
                    b.classList.add('extension-candleappstore-selected-install-button');
                    b.classList.add('extension-candleappstore-button');
                    var t = document.createTextNode("Install");
                    b.appendChild(t);
					b.addEventListener('click', (event) => {
                        console.log("install button clicked");
                        console.log(event);
                        event.stopImmediatePropagation();
                        console.log( data['versions'][i]["addon_id"] );
                        
                        
                        
                        window.API.installAddon( data['versions'][i]["addon_id"], data['versions'][i]["download_url"], data['versions'][i]["checksum"] )
                        .then((result) => { 
							console.log("installation result: ");
							console.log(result); 
                            
                            this.installed.push(data[i]["addon_id"]);
                            document.getElementById("extension-candleappstore-selected").style.display = 'none';                            

						}).catch((e) => {
							console.log("installation catch (error?)");
                            console.log(e);
							pre.innerText = e.toString();
						});
                    });
                    console.log("adding install button");
                    selected_options_bar.appendChild(b);
                }
                
                // ADD UNINSTALL BUTTON
                else if( installed && data['versions'][i]["addon_id"] != undefined ){
                    var b = document.createElement("button");
                    b.classList.add('extension-candleappstore-selected-uninstall-button');
                    b.classList.add('extension-candleappstore-button');
                    var t = document.createTextNode("Uninstall");
                    b.appendChild(t);
					b.addEventListener('click', (event) => {
                        console.log("uninstall button clicked");
                        console.log(event);
                        event.stopImmediatePropagation();
                        console.log( data['versions'][i]["addon_id"] );
                        
                        const addon_id = data['versions'][i]["addon_id"];
                        
                        var really = confirm("Are you sure you want to uninstall this addon?");
                        if (really) {
                            window.API.uninstallAddon( data['versions'][i]["addon_id"] )
                            .then((result) => { 
    							console.log("uninstallation result: ");
                                console.log("addon_id: " + addon_id + " was uninstalled, in theory.");
    							console.log(result); 
                                document.getElementById("extension-candleappstore-selected").style.display = 'none';
                                //document.getElementById("extension-candleappstore-settings").style.display = 'none';
                            
                                console.log("this.installed = " + this.installed );
                                for (var i=this.installed.length-1; i>=0; i--) {
                                    if (this.installed[i] === addon_id) {
                                        this.installed.splice(i, 1);
                                    }
                                }
                            
                                this.generate_overview();
                            
    						}).catch((e) => {
    							console.log("uninstallation catch (error?)");
                                console.log(e);
    							pre.innerText = e.toString();
    						});
                        }
                        
                        
                    });
                    console.log("adding uninstall button");
                    selected_options_bar.appendChild(b);
                }
                //installAddon
                
            }
            catch(e){
                console.log("Error in show selected app: " + e);
            }
                
            
            try{
                // SHOW RATINGS
                // handles the display of the last 100 ratings
                
                const original_review_item = document.getElementById('extension-candleappstore-original-review-item');
                const reviews_container = document.getElementById('extension-candleappstore-reviews-container');
                const reviews_list = document.getElementById('extension-candleappstore-reviews-list');
                reviews_container.style.display = "none";
                reviews_list.innerHTML = "";
                
                
                if( data.hasOwnProperty('ratings') ){
                    reviews_container.style.display = "block";
                    console.log(data['ratings'].length + " RATING(S) EXIST");
                    
                    var rating_count = "100+";
                    if(data['ratings'].length < 100){
                        rating_count = data['ratings'].length;
                    }
                    document.getElementById('extension-candleappstore-histogram-total-rating-count').innerText = rating_count;
                    
                    var ratings_added_up = 0;
                    var risk_added_up = 0;
                    var risk_counter = 0;
                    var ratings_count_array = [0,0,0,0,0,0];
                    for(let i = 0; i < data['ratings'].length; i++){
                        console.log( data['ratings'][i] );
                        
                        var clone = original_review_item.cloneNode(true);
                        clone.removeAttribute('id');
                        //clone.setAttribute('data-addon-id', data[i].addon_id);
                        //clone.style.background = "#" + this.string_to_color(data[i].addon_id);
                    
                        const keys = Object.keys(data['ratings'][i]);
                        console.log(keys);
    					keys.forEach((info, index) => {
                            console.log(info);
                            
                            const selector_name = '.extension-candleappstore-review-item-' + info;
                            console.log("selector name: " + selector_name);
                            var target_element = clone.querySelectorAll( selector_name )[0];
                            if(target_element != undefined){
                                console.log("- element existed");
                                //if(info == 'review' || info == 'username'){     
                                    var t = document.createTextNode(data['ratings'][i][info]);
                                    target_element.appendChild(t);
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
                                    risk_added_up = risk_added_up + data['ratings'][i]['risk'];
                                }
                            }
                    
                        });
                        
                        //clone.classList.add("installed");
                        //clone.setAttribute('data-installed', 0);
                        reviews_list.appendChild(clone); 
                        ratings_added_up = ratings_added_up + Number(data['ratings'][i]['rating']);
                        
                        ratings_count_array[ data['ratings'][i]['rating'] ]++;
                        
                    }
                    console.log("ratings_added_up = " + ratings_added_up);
                    const average_rating = ratings_added_up / data['ratings'].length;
                    console.log("average_rating = " + average_rating);
                    //const rounded_rating = Math.round(average_rating * 10) / 10;
                    const rounded_rating = ((average_rating * 10) /10 ).toFixed(1);
                    document.getElementById('extension-candleappstore-histogram-average-rating').innerText = rounded_rating;
                    
                    console.log(ratings_count_array);
                    for(let r = 1; r < ratings_count_array.length; r++){
                        //const target_rating_counter = 
                        
                        document.getElementById('extension-candleappstore-histogram-rating-count' + r).innerText = ratings_count_array[r];
                        document.getElementById('extension-candleappstore-histogram-bar' + r).style.width = 1 + (ratings_count_array[r] * 2) + "px";
                        
                    }
                        
                    if(risk_counter > 1){
                        const average_risk = risk_added_up / risk_counter;
                        const rounded_risk = Math.round(average_risk * 10) / 10;
                        //document.getElementById('extension-candleappstore-histogram-average-rating').innerText = 4;
                    }
                    
                }
                
                
                
                
                /*
                const stars = document.getElementById("extension-candleappstore-stars-rating");
                stars.addEventListener('click', function(event) {
                    console.log(event);
                    const target = event.target;
                    if (event.target.tagName.toLowerCase() === 'label') {
                        console.log("clicked on a star");
                        console.log( event.target.htmlFor.slice(-1) );
                        document.getElementById("extension-candleappstore-review-container").style.display = "block";
                    }
                });
                */
                

                /*
                // Get data for apps overview
                this.get_data("login_json.php",login_data).then(response => {
                    console.log("LOGIN RESPONSE!");
                    console.log(response);
                    console.log("typeof response = " + typeof response);
                    
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
                console.log("Error in adding ratings to selected app display: " + e);
            }    

            
        }
        
        
        
        
        
        
        //
        //  SHOW ADDON SETTINGS
        //
        
        show_addon_config(addon_id,data){
            try{
                console.log("in show_addon_config for " + addon_id);
                console.log(data);
                //console.log(data['body']);
                
                var spotted_advanced_setting = false;
            
                const settings_container = document.getElementById('extension-candleappstore-settings');
                const pre = document.getElementById('extension-candleappstore-response-data');
                const form = document.getElementById('extension-candleappstore-settings-form');
                const advanced_form = document.getElementById('extension-candleappstore-advanced-settings-form');
                const advanced_form_container = document.getElementById("extension-candleappstore-advanced-settings-form-container");
                const settings_options_bar = document.getElementById("extension-candleappstore-settings-options");
                
                const permissions_dropdown = document.getElementById("extension-candleappstore-permissions");
                
                form.innerHTML = "";
                advanced_form.innerHTML = "";
                settings_options_bar.innerHTML = "";
                advanced_form_container.style.display = "none";
                settings_container.classList.remove("extension-candleappstore-busy");
                
                const data_keys = Object.keys(data);
                if(data_keys.length == 0){
                    form.innerHTML = '<p>This addon does not have any settings.</p>';
                    return;
                }
                console.log("data keys length = " + data_keys.length);
                var abort = false;
                data_keys.forEach((info, index) => {
                    console.log("typeof data[info] = " + typeof data[info]);
                    if(typeof data[info] == 'object'){
                        console.log("Houston, we have a problem");
                        form.innerHTML = '<a href="/settings/addons/config/' + addon_id + '">Click here to change settings</a>';
                        abort = true;
                        return;
                    }
                });
                if(abort){
                    return;
                }
                
                var addon_settings_schema = {};
                var api_data = null;
                for(let i = 0; i < this.api_addons_data.length; i++){
                    if( this.api_addons_data[i]['id'] == addon_id ){
                        api_data = this.api_addons_data[i];
                        if(this.api_addons_data[i].hasOwnProperty('schema')){
                            addon_settings_schema = this.api_addons_data[i]['schema'];
                        }
                    }
                }
                if(addon_settings_schema == {}){
                    form.innerHTML = '<span class="extension-candleappstore-error">Error, could not load settings</span>';
                    return;
                }
                console.log("api_data = ");
                console.log(api_data);
                
                //console.log("window.origin = " + window.origin);
                
                if(!addon_settings_schema.hasOwnProperty('properties')){
                    form.innerHTML = '<span class="extension-candleappstore-info">This addon does not have any settings.</span>';
                    return;
                }
                
                /*
                if(addon_settings_schema.hasOwnProperty("type")){
                    if(addon_settings_schema['type'] == 'object'){
                        console.log("It's a complex addon setting, with arrays.");
                        form.innerHTML = '<span class="extension-candleappstore-info">This addon does not have any settings.</span>';
                        
                        const base_url = window.location.protocol + "//" + window.location.host + '/settings/addons/config/';
                        
                        form.innerHTML = '<a href="/settings/addons/config/' + addon_id + '">Click here to change settings</a>';
                        
                        document.getElementById("settings-back-button").addEventListener('click', (event) => {
                            console.log("settings back button clicked");
                            console.log(event);
                            event.stopImmediatePropagation();
                            if(document.location.href.startsWith(base_url)){
                                console.log("attempting to go back to app store.");
                                //document.location.href = window.origin; //window.location.protocol + "//" + window.location.host + '/extensions/candleappstore';
                                window.location.href = window.origin + '/extensions/candleappstore';
                                
                                window.test1 = setTimeout(function(){
                                    console.log("1 second later");
                                    //document.location.href = window.origin;
                                    window.location.href = window.origin + '/extensions/candleappstore';
                                    //document.location.href = window.location.protocol + "//" + window.location.host + '/extensions/candleappstore';
                                }, 1000);  
                                window.test2 = setTimeout(function(){
                                    console.log("4 seconds later");
                                    //document.location.href = window.origin;
                                    //document.location.href = window.location.protocol + "//" + window.location.host + '/extensions/candleappstore';
                                }, 4000); 
                            }
                        });
                        //this.hide();
                        
                        //document.location.href = base_url + addon_id;
                        
                        return;
                    }
                }
                */
                
                console.log("addon_settings_schema:");
                console.log(addon_settings_schema);
                
                const addon_settings_props = addon_settings_schema['properties'];
                
                var addon_settings_required = [];
                if(addon_settings_schema.hasOwnProperty('required')){
                    addon_settings_required = addon_settings_schema['required'];
                }
                
                const settings_keys = Object.keys(addon_settings_props);
                console.log("addon_settings_props:");
                console.log(addon_settings_props);
                console.log("all props: " + settings_keys);
                console.log("addon_settings_required = " + addon_settings_required);
                
                /*
                settings_keys.forEach((info, index) => {
                    if()
                });
                */
                
                settings_keys.forEach((info, index) => {
                    console.log("ADDING SETTING ITEM: " + info);
                    var advanced = false;
                    var is_required = false;
                    

                    const css_element_id = 'extension-candleappstore-settings-setting-' + this.makeSafeForCSS(info);
                    var d = document.createElement("div");

                    //
                    //  ADDING EXTRA PERMISSION DROPDOWN FOR TOKEN
                    //

                    if(info.toLowerCase() == 'authorization token'){
                        var token_state = null;
                        if(this.permissions.hasOwnProperty(addon_id)){
                            console.log("Info about permissions for this addon existed");
                            if( this.permissions[addon_id].hasOwnProperty('token') ){
                                token_state = this.permissions[addon_id]['token'];
                            }
                        }
                        console.log("Authorization token input field spotted");
                        /*
                        if(api_data != null){
                            document.getElementById("extension-candleappstore-permissions-title").innerText = api_data['name'];
                        }
                        */
                        
                        // If the token string is empty, that means the permission is 'none'.
                        if(token_state == null && data[info] == ""){
                            token_state = 'none';
                        }
                        
                        var xd = document.createElement("div");
                        xd.classList.add('extension-candleappstore-settings-permission-setting');
                        
                        var xl = document.createElement("label");
                        xl.for = info + "-permission";
                        var xt = document.createTextNode("Access to your things");
                        xl.appendChild(xt); // append text to label
                    
                        xd.appendChild(xl); // append label to div
                        
                        
                        console.log("should create permission enum");
                        var xs = document.createElement("select");
                        xs.name = info + "-permission";
                        
						//const property_lists = this.get_property_lists(this.all_things[thing]['properties']);
						//console.log("property lists:");
						//console.log(property_lists);
						
                        //const possible_permissions = {'none':'No access', 'read':'Read only', 'full':'Read and toggle'};
                        const possible_permissions = {'none':'No access', 'full':'Read and toggle'};
                        
                        const permission_keys = Object.keys(possible_permissions);
                    
    					permission_keys.forEach((preference, index) => {
                        
                        //for(let q = 0; q < possible_permissions.length; q++){
						//for( var title in data[info]['enum'] ){
                            //const option_name = addon_settings_props[info]['enum'][q];
							console.log("adding permissions preference option: " + preference);
                            const new_option_element = new Option(preference, possible_permissions[preference]);
							
                            if(token_state == preference){
                                console.log("spotted selected permission dropdown option");
                                // found the selected item
                                //new_option_element.selected = true;
                                new_option_element.setAttribute("selected", "selected");
                            }
                            xs.options[xs.options.length] = new_option_element;
						});
                        
                        xs.addEventListener('change', (event) => {
                            console.log("permission dropdown changed");
                            console.log(event);
                            event.stopImmediatePropagation();
                            //this.remember_permission(addon_id,'token','none');
                            
                            console.log("new value: " + event.target.value);
                            //revokeAuthorization
                            
                            if(event.target.value == possible_permissions['none']){
                                console.log("permission was set to none. Revoke?");
                                document.getElementById(css_element_id).value = "";
                            }
                            else if(event.target.value == possible_permissions['read']){
                                console.log("permission was set to read only");
                                
                                // http://thuis.local/oauth/authorize?response_type=code&client_id=local-token&scope=/things:readwrite&state=asdf
                            }
                            else if(event.target.value == possible_permissions['full']){
                                console.log("permission was set to full");
                                console.log( localStorage.getItem('jwt') );
                                console.log("target input el: " + css_element_id);
                                document.getElementById(css_element_id).value = localStorage.getItem('jwt');
                                
                                //http://thuis.local/oauth/authorize?response_type=code&client_id=local-token&scope=/things:readwrite&state=asdf
                            }
                            
                        });
                        
                        xd.appendChild(xs);
                        
                        // Add description
                        var xp = document.createElement("p");
                        const xpt = document.createTextNode("This app would like permission to control your devices. Is that ok?");
                        xp.appendChild(xpt);
                        xd.appendChild(xp); // append description to div
                        
                        form.appendChild(xd);
                        
                        /*
                        //permissions_dropdown.style.display = 'block';
                        var x = document.createElement("div");
                        var xt = document.createTextNode(api_data['name'] = " would like permission to read the state of and toggle your devices. Is that ok?");
                        x.appendChild(xt);
                        
                        var po = document.createElement("div");
                        //s.id = css_element_id
                        
                        var none = document.createElement("button");
                        var nonet = document.createTextNode("no");
                        none.appendChild(not);
                        none.classList.add('extension-candleappstore-permission-button-no');      
                        
                        none.addEventListener('click', (event) => {
                            console.log("no button clicked");
                            console.log(event);
                            event.stopImmediatePropagation();
                            this.remember_permission(addon_id,'token','none');
                        });
                        po.appendChild(none);
                        
                        
                        var read = document.createElement("button");
                        var readt = document.createTextNode("Read only");
                        read.appendChild(readt);
                        read.classList.add('extension-candleappstore-permission-button-read'); 
                        
                        read.addEventListener('click', (event) => {
                            console.log("read button clicked");
                            console.log(event);
                            event.stopImmediatePropagation();
                            this.remember_permission(addon_id,'token','read');
                        });
                        po.appendChild(read);
                        
                        var full = document.createElement("button");
                        var fullt = document.createTextNode("Read and toggle");
                        full.appendChild(fullt);
                        full.classList.add('extension-candleappstore-permission-button-full'); 
                        
                        full.addEventListener('click', (event) => {
                            console.log("read and write button clicked");
                            console.log(event);
                            event.stopImmediatePropagation();
                            this.remember_permission(addon_id,'token','full');
                        });
                        po.appendChild(full);
                        x.appendChild(po);
                        */
                        
                        
                        //return;
                    }
                    
                    //addon_settings_props
                    if( addon_settings_required != undefined){
                        if(addon_settings_required.indexOf(info) != -1){
                            console.log("-is_required");
                            is_required = true;
                            d.classList.add('extension-candleappstore-required-setting');      
                        }
                    }

                    
                    var l = document.createElement("label");
                    l.for = info;
                    var t = document.createTextNode(info);
                    l.appendChild(t); // append text to label
                    
                    d.appendChild(l); // append label to div
                    //s.classList.add('extension-candleappstore-nice-name-span');      
                    //var t = document.createTextNode(data[i][info]);
                    //s.appendChild(t);
                    
                    // prepare description
                    
                    var description = addon_settings_props[info]['description'];
                    var p = document.createElement("p");
                    if(description != undefined){
                        if( description.startsWith('Advanced.') ){
                            console.log("descriptions started with Advanced.");
                            advanced = true;
                            description = description.replace('Advanced. ','');
                            description = description.replace('Advanced.','');
                        }
                        console.log(description);
                        
                        var pt = document.createTextNode(description);
                        p.appendChild(pt); // append description text to paragraph
                    }
                    
                    
                    
                    
                    
                    
                    
                    
                    try{
                        //if( typeof info == "boolean" ){
                        if( addon_settings_props[info]['type'] == 'boolean'){
                        //if(addon_settings_schema[info] == "true" || data[info] == "false"){
                            console.log("boolean spotted. checked = " + data[info]);
                            var s = document.createElement("input");
                            s.id = css_element_id
                            
                            s.name = info;
                            s.type = "checkbox";
                            if(data[info] == "true"){
                                s.checked = true;
                            }
                            d.appendChild(s);
                            
                            d.appendChild(p); // append description to div
                            
                        }
                        else if( addon_settings_props[info].hasOwnProperty('enum') ){
                            console.log("should create enum");
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
								console.log("adding enum option: " + option_name);
                                const new_option_element = new Option(option_name, option_name);
								
                                if(data[info] == option_name){
                                    console.log("spotted selected dropdown option");
                                    // found the selected item
                                    //new_option_element.selected = true;
                                    new_option_element.setAttribute("selected", "selected");
                                }
                                s.options[s.options.length] = new_option_element;
							}
                            d.appendChild(s);
                            
                            d.appendChild(p); // append description to div
                            
                        }
                        else{
                            console.log("string spotted");
                            var s = document.createElement("input");
                            s.id = css_element_id;
                            s.name = info;
                            
                            var input_type = 'text';
                            if(addon_settings_props[info]['type'] != "string"){
                                if(addon_settings_props[info]['type'] == "integer"){
                                    input_type = "number";
                                }
                                else{
                                    input_type = addon_settings_props[info]['type'];
                                }
                            }
                            if(info.toLowerCase() == 'authorization token'){
                                d.classList.add('extension-candleappstore-hidden-setting'); 
                            }
                            
                            s.type = input_type;
                            
                            if(data[info] != undefined){
                                s.value = data[info];
                            }
                            
                            
                            if(is_required){
                                s.required = true;
                            }
                            
                            //s.classList.add('extension-candleappstore-nice-name-span');      
                            //var t = document.createTextNode(data[i][info]);
                            //s.appendChild(t);
                            
                            
                            
                            d.appendChild(s);
                            
                            d.appendChild(p); // append description to div
                        }
                        
                    
                    }
                    catch(e){
                        console.log("Error popularing selected: " + e);
                    }
                    


                    
                    console.log("advanced = " + advanced);
                    console.log("is_required = " + is_required);
                    // split new settings items between normal and advanced area
                    if( advanced && !is_required){
                        spotted_advanced_setting = true;
                        advanced_form.appendChild(d);
                        advanced_form_container.style.display = "block";
                    }
                    else{
                        form.appendChild(d);
                    }
                    
                    
                });
                
                // ADD SETTINGS SAVE BUTON
                var b = document.createElement("button");
                b.classList.add('extension-candleappstore-settings-save-button');
                b.classList.add('extension-candleappstore-button');
                var t = document.createTextNode("Save");
                b.appendChild(t);
				b.addEventListener('click', (event) => {
                    console.log("settings save button clicked");
                    console.log(event);
                    event.stopImmediatePropagation();
                    
                    //const addon_id = data[i]["addon_id"];
                    
                    // extract new settings
                    var missing_value = false;
                    var new_data = {};
                    settings_keys.forEach((info, index) => {
                        console.log("EXTRACTING SETTING ITEM: " + info);
                    
                        const css_element_id = 'extension-candleappstore-settings-setting-' + this.makeSafeForCSS(info);
                        console.log("target element id: --" + css_element_id + '--');
                        var target_element = document.getElementById( css_element_id );
                        
                        console.log("setting extraction target element:");
                        console.log(target_element);
                        
                        try{
                            //if( typeof info == "boolean" ){
                            if( addon_settings_props[info]['type'] == 'boolean'){                                
                                new_data[info] = target_element.checked;
                            
                            }
                            else{
                                var value = target_element.value;
                                
                                if( target_element.required && value == "" ){
                                    console.log("required value was not filled");
                                    missing_value = true;
                                    target_element.classList.add("extension-candleappstore-settings-empty-warning"); 
                                }
                                new_data[info] = value;

                            }
                           
                            console.log("new_data[info] = " + new_data[info]);
                    
                        }
                        catch(e){
                            console.log("Error extracting setting value: " + e);
                        }
                    
                    });
                    
                    if(missing_value == false){
                        
                        console.log("WILLL SAVE NEW ADDONS SETTINGS:");
                        console.log(new_data);
                        
                        settings_container.classList.add("extension-candleappstore-busy");
                        
                        //window.API.setAddonConfig( addon_id, JSON.stringify(new_data) )
                        window.API.setAddonConfig( addon_id, new_data )
                        .then(() => { 
    						console.log("saved settings result for addon: " + addon_id);
    						//console.log(result); 
                            document.getElementById("extension-candleappstore-settings").style.display = 'none';
                        
    					}).catch((e) => {
    						console.log("uninstallation catch (error?)");
                            console.log(e);
    						pre.innerText = e.toString();
                            document.getElementById("extension-candleappstore-settings").style.display = 'none';
    					});
                        
                    }
                    else{
                        alert("A required value was not filled in and/or selected");
                    }
                    
                    

                });
                
                
                settings_options_bar.appendChild(b);
                
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

            return this.shade(this.int_to_rgba(this.hash(str)), -10);

        }
        
	}

	new Candleappstore();
	
})();


