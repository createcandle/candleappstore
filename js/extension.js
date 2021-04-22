(function() {
	class Candleappstore extends window.Extension {
	    constructor() {
	      	super('candleappstore');
			console.log("Adding candleappstore addon to menu");
      		
			this.addMenuEntry('Candle App Store');
	
	      	this.content = '';
            
            this.apps_overview = {};
            this.installed = [];
            

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
	    }

		

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
            console.log(window.API.getInstalledAddons());
            console.log(window.API.getAddonConfig("airport"));
            console.log(window.API.uninstallAddon);
            window.API.uninstallAddon("bla");
            
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
			
			
			const list = document.getElementById('extension-candleappstore-list');
			const pre = document.getElementById('extension-candleappstore-response-data');
            const installed_list = document.getElementById('extension-candleappstore-installedlist');
            const selected = document.getElementById('extension-candleappstore-selected');
            const selected_close_button = document.getElementById('extension-candleappstore-selected-close-container')
            //console.log("installedlist:");
            //console.log(installedlist);
            
			selected_close_button.addEventListener('click', (event) => {
                console.log("Close button clicked");
                selected.style.display = 'none';
			});
            
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
                console.log("IN THEN. This:");
                console.log(this);
                const parsed = JSON.parse(response);
                console.log(parsed);
                this.generate_overview( parsed ); 
            });
            
            
            //
            // INIT
            //
			window.API.postJson(
				`/extensions/candleappstore/api/ajax`,
				{'action':'init'}
			).then((body) => { 
				//console.log("clear item reaction: ");
				//console.log(body);
				if( body['state'] != true ){
					pre.innerText = body['message'];
				}
                else{
                    this.app_store_url = body['app_store_url'];
                    this.installed = body['installed']
                    //this.generate_installed( body['installed'] );
                }

			}).catch((e) => {
				console.log("candleappstore: error in clear device handler");
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
				//console.log(event);
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
            console.log(this);
            return new Promise((myResolve, myReject) =>
            {
                console.log("url = " + url);
                console.log("parameters = " + parameters);
                
                console.log(this);
                
    	        window.API.postJson(
    	            `/extensions/${this.id}/api/ajax`,
    			    {'action':'get_json','url':url,'parameters':parameters}

    	        ).then((body) => {
    				console.log("Python API /get_json result:");
    				console.log(body);
                
    				if(body['state'] == true){
                        pre.innerText = body['message'];						
                        myResolve(body['body']);
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
    
    
        //
        //  GENERATE OVERVIEW
        //
    
        generate_overview(data){
            try{
                console.log("in generate_overview");
    			const pre = document.getElementById('extension-candleappstore-response-data');
    			const list = document.getElementById('extension-candleappstore-list');
    			//const original = document.getElementById('extension-candleappstore-original-item');
                const original_basic_item = document.getElementById('extension-candleappstore-original-item');
                const installed_list = document.getElementById('extension-candleappstore-installedlist');
                
                
            
                //
                //  UPDATE ADDONS
                //
                
                list.innerHTML = "";
                
                console.log("addon count: " + data.length);
                
                
                
                for(let i = 0; i < data.length; i++){
                    //console.log(data[i].name);

                    var clone = original_basic_item.cloneNode(true);
                    clone.removeAttribute('id');
                    clone.setAttribute('data-addon-id', data[i].addon_id);
                    clone.style.background = "#" + this.string_to_color(data[i].addon_id);
                    
                    
                    const keys = Object.keys(data[i]);
                    
					keys.forEach((info, index) => {
                        //console.log(info);
                        
                        
                        if(info == 'name' || info == 'description' || info == 'mac'){
                            
                            var s = document.createElement("span");
                            //s.classList.add('extension-candleappstore-nice-name-span');      
                            var t = document.createTextNode(data[i][info]);
                            s.appendChild(t);
                            
                            const selector_name = '.extension-candleappstore-basic-' + info;
                            var target_element = clone.querySelectorAll( selector_name )[0];
                            target_element.appendChild(s);
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
                    
                    
					clone.addEventListener('click', (event) => {
                          
                        console.log(event);
                        
                        event.stopImmediatePropagation();
                        
                        //target.dataset.domain
                        const selected = document.getElementById('extension-candleappstore-selected');
                        selected.style.display = 'block';
                        
						var target = event.currentTarget;
                        console.log(target);
                        
                        
						//var parent3 = target.parentElement.parentElement.parentElement;
						//parent3.classList.add("delete");
						//var parent4 = parent3.parentElement;
						//parent4.removeChild(parent3);
	                    console.log(target.dataset);
                        //console.log("addon_id = " + target.dataset['addon-id']);
                        //const url = "get_addons.php?addon_id=" + target.dataset.addon_id;
                        const url = "get_apps.php?addon_id=" + target.getAttribute('data-addon-id');
                        console.log(url);
                        
                        
						window.API.postJson(
							`/extensions/candleappstore/api/ajax`,
							{'action':'get_json','url':url}
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
                        
                            

    				});
                    
                    if( this.installed.indexOf(data[i].addon_id) == -1 ){
                        clone.classList.add("installed");
                        clone.setAttribute('data-installed', 1);
                        list.appendChild(clone); 
                    }
                    else{
                        clone.setAttribute('data-installed', 0);
                        installed_list.appendChild(clone); 
                    }
                        
                    
                    
                } // end of for loop
                
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
        
        show_selected_app(data, installed){
            try{
                console.log("in show_selected_app");
                console.log(data);
                console.log("installed: " + installed);
                //console.log(data['body']);
            
                const selected = document.getElementById('extension-candleappstore-selected');
            
                var i = 0;
                const keys = Object.keys(data[i]);
                
    			keys.forEach((info, index) => {
                    console.log(info);
                    
                    const selector_name = '.extension-candleappstore-selected-' + info;
                    var target_element = selected.querySelectorAll( selector_name )[0];
                    
                    if(data[i][info] != null && target_element != undefined){
                        
                        try{
                            if( info.endsWith("_url") ){
                                target_element.href = data[i][info];
                            }
                            else{
                                var s = document.createElement("span");
                                //s.classList.add('extension-candleappstore-nice-name-span');      
                                var t = document.createTextNode(data[i][info]);
                                s.appendChild(t);
                                target_element.appendChild(s);
                            }
                        
                        }
                        catch(e){
                            console.log("Error popularing selected: " + e);
                        }
                    }
                    
                });
                
                document.getElementById("extension-candleappstore-selected-options").innerHTML = "";
                if( data[i]["addon_id"] != undefined && data[i]["download_url"] != undefined && data[i]["checksum"] != undefined ){
                    var b = document.createElement("button");
                    b.classList.add('extension-candleappstore-selected-install-button');      
                    var t = document.createTextNode("Install");
                    b.appendChild(t);
					b.addEventListener('click', (event) => {
                        console.log("install button clicked");
                        console.log(event);
                        event.stopImmediatePropagation();
                        console.log( data[i]["addon_id"] );
                    
                        
                        
                        window.API.installAddon( data[i]["addon_id"], data[i]["download_url"], data[i]["checksum"] )
                        .then((result) => { 
							console.log("installation result: ");
							console.log(result); 

						}).catch((e) => {
							console.log("installation catch (error?)");
                            console.log(e);
							pre.innerText = e.toString();
						});
                    });
                    console.log("adding install button");
                    document.getElementById("extension-candleappstore-selected-options").appendChild(b);
                }
                //installAddon
                
                // 
                
            }
            catch(e){
                console.log("Error in filling selected: " + e);
            }
            
        }
        
        
        
        
    
		//
		//  REGENERATE ITEMS
		//
	    regenerate_items(){
            try {
                console.log("inn regenerate_items");
    			const pre = document.getElementById('extension-candleappstore-response-data');
    			const list = document.getElementById('extension-candleappstore-list');
    			const original = document.getElementById('extension-candleappstore-original-item');
                const original_basic_item = document.getElementById('extension-candleappstore-original-domain-item');
                const installedlist = document.getElementById('extension-candleappstore-installedlist');
            
            
            
            
            
            
            
            
            
                //
                //  UPDATE installedlist
                //
            
            
				//var domain_clone = original_basic_item.cloneNode(true);
				//domain_clone.removeAttribute('id');
                //console.log("domain_clone:");
                //console.log(domain_clone);
                
                
                // domain
                

                //domain_clone.querySelectorAll( '.extension-candleappstore-domain-domain' )[0].appendChild(s);
                
                //console.log(this.animals[mac]['domains'][domain]);
                //console.log(this.animals[mac]['domains'][domain]['timestamps']);
                
                
                // count
                
                //const master_installedlist_length = this.master_installedlist.length;
                //console.log("master_installedlist_length = " + master_installedlist_length);
                
                //console.log("__timestamps__");
                //console.log(this.animals[mac]['domains'][domain]['timestamps']);
                //console.log("domain_count: " + domain_count);
                
                //var q = document.createElement("span");
                //var q = document.createTextNode(this.animals[mac]['domains'][domain]['timestamps'].length);
                //q.appendChild(w);
                //domain_clone.querySelectorAll( '.extension-candleappstore-domain-count' )[0].appendChild(q);

				//clone.querySelectorAll( '.extension-candleappstore-domains' )[0].appendChild(domain_clone);
                
                //const select_options = ['blocked','allowed'];
                //var select = document.createElement("select");
                //select.setAttribute("class", "extension-candleappstore-domains-permission-select");
                //select.setAttribute("data-domain", domain);
                //select.setAttribute("data-mac", mac);

                installedlist.innerHTML = "";
                for (let i = 0; i < this.master_installedlist.length; i++) {
                    //console.log("[] adding " + select_options[i]);
                    //select.options.add(new Option(select_options[i], select_options[i]));
                    const domain = this.master_installedlist[i];
                    
                    var f = document.createElement("div");
                    f.setAttribute("data-domain", domain);
                    var y = document.createElement("span");
                    var s = document.createTextNode(domain);
                    y.appendChild(s);
                    f.appendChild(y);
                
                    var g = document.createElement("button");
                    g.setAttribute("data-domain", domain);
                    g.setAttribute("class", "extension-candleappstore-button extension-candleappstore-installedlist-remove-button");
                    var h = document.createTextNode("unblock");
                    g.appendChild(h);
                    f.appendChild(g);
                    
                    installedlist.appendChild(f); 
                            
                }
                
                /*
                var remove_buttons = document.getElementsByClassName("extension-candleappstore-installedlist-remove-button");

                for (var i = 0; i < remove_buttons.length; i++) {
                    (function () {
                        remove_buttons[i].addEventListener("click", function() { makeItHappen(boxa,boxb); }, false);
                        elem[k].addEventListener("click", function() { makeItHappen(boxb,boxa); }, false);
                    }()); // immediate invocation
                }
                */
                
				
			  	//});
                
                //domain_clone.querySelectorAll( '.extension-candleappstore-domain-permission' )[0].appendChild(select);
            
            
            
            
            
            
                //
                //  UPDATE DEVICES
                //
                
                list.innerHTML = "";
                //console.log(".")
                //console.log("..")
                //console.log("animals:");
                //console.log(this.animals);
                //console.log("looping over animals now:");
                
                const keys = Object.keys(this.animals);

                // print all keys
                //console.log(keys);

                //console.log("Active for more than 90 seconds. Currently no devices connected.");
                if(keys.length == 0 ){
					list.innerHTML = '<div class="extension-candleappstore-centered-page" style="text-align:center"><p>There are currently no devices on the candleappstore network.</p></div>';
				    return;
                }



                // iterate over object
                keys.forEach((mac, index) => {
                    //console.log(`${mac}: ${this.animals[mac]}`);

					var clone = original.cloneNode(true);
					clone.removeAttribute('id');

                    //var protected_animal = false;
                    //if( this.animals[mac].hasOwnProperty('protected') ){
                    //    protected_animal = true;
                    //}
                    
                    const animal_parts = Object.keys(this.animals[mac]);
                    //console.log("animal parts: ");
                    //console.log(animal_parts)
					animal_parts.forEach((info, index2) => {
                        if(info == 'nicename' || info == 'vendor' || info == 'mac'){
                            //console.log(`${info}: ${this.animals[mac][info]}`);
                            if(info == 'vendor' && this.animals[mac][info] == 'unknown'){
                                return;
                            }
                            
                            var s = document.createElement("span");
                            //s.classList.add('extension-candleappstore-nice-name-span');      
                            var t = document.createTextNode(this.animals[mac][info]);
                            s.appendChild(t);
                            
                            const selector_name = '.extension-candleappstore-' + info;
                            var target_element = clone.querySelectorAll( selector_name )[0];
                            target_element.appendChild(s);
                        }
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
                        else if(info == 'domains'){
                            try{
                                //console.log("generating domains list");
                                //console.log(this.animals[mac]['domains']);
                                const domains_list = Object.keys(this.animals[mac]['domains']);
                                //console.log("keys:");
                                //console.log(domains_list);
                                domains_list.forEach((domain, index3) => {
                                    
                					var domain_clone = original_basic_item.cloneNode(true);
                					domain_clone.removeAttribute('id');
                                    //console.log("domain_clone:");
                                    //console.log(domain_clone);
                                    
                                    
                                    // domain
                                    
                                    //var s = document.createElement("span");
                                    var s = document.createTextNode(domain);
                                    //s.appendChild(t);
                                    domain_clone.querySelectorAll( '.extension-candleappstore-domain-domain' )[0].appendChild(s);
                                    
                                    //console.log(this.animals[mac]['domains'][domain]);
                                    //console.log(this.animals[mac]['domains'][domain]['timestamps']);
                                    
                                    
                                    // count
                                    
                                    const domain_count = this.animals[mac]['domains'][domain]['timestamps'].length;
                                    //console.log("__timestamps__");
                                    //console.log(this.animals[mac]['domains'][domain]['timestamps']);
                                    //console.log("domain_count: " + domain_count);
                                    
                                    //var q = document.createElement("span");
                                    var q = document.createTextNode(this.animals[mac]['domains'][domain]['timestamps'].length);
                                    //q.appendChild(w);
                                    domain_clone.querySelectorAll( '.extension-candleappstore-domain-count' )[0].appendChild(q);

                					clone.querySelectorAll( '.extension-candleappstore-domains' )[0].appendChild(domain_clone);
                                    
                                    const select_options = ['blocked','allowed'];
                                    var select = document.createElement("select");
                                    select.setAttribute("class", "extension-candleappstore-domains-permission-select");
                                    select.setAttribute("data-domain", domain);
                                    select.setAttribute("data-mac", mac);

                                    for (let i = 0; i < select_options.length; i++) {
                                        //console.log("[] adding " + select_options[i]);
                                        //select.options.add(new Option(select_options[i], select_options[i]));
                                        var option = document.createElement("option");
                                                option.value = select_options[i];
                                                option.text = select_options[i];
                                                if (select_options[i] ==  'blocked' && this.master_installedlist.indexOf(domain) >= 0) {
                                                    option.selected = true;
                                                }
                                                else if( select_options[i] == this.animals[mac]['domains'][domain]['permission'] ){
                                                    //console.log("setting selected option");
                                                    option.selected = true;
                                                }
                                                select.appendChild(option);
                                                
                                                
                                    }
                                    
                                    domain_clone.querySelectorAll( '.extension-candleappstore-domain-permission' )[0].appendChild(select);
                                    
                                    /*
                					const permission_select = clone.querySelectorAll('.extension-candleappstore-domains-permission-select')[0];
                                    //console.log("adding change event listener to dropdown:");
                                    //console.log(permission_select);
                					permission_select.addEventListener('click', (event) => {
                                        console.log("change detected");
                                        event.stopImmediatePropagation();
                                        
                                        //target.dataset.domain
                                        
                                        
                						var target = event.currentTarget;
                                        console.log(target);
                                        
                                        
                						//var parent3 = target.parentElement.parentElement.parentElement;
                						//parent3.classList.add("delete");
                						//var parent4 = parent3.parentElement;
                						//parent4.removeChild(parent3);
					                    
                                        console.log(target.dataset.domain);
                                        console.log(target.dataset.mac);
                                        
                                        
                						// Send new values to backend
                						window.API.postJson(
                							`/extensions/${this.id}/api/ajax`,
                							{'action':'set_permission','domain':target.dataset.domain, 'permission':target.value, 'mac':target.dataset.mac}
                						).then((body) => { 
                							console.log("update permission reaction: ");
                							console.log(body); 
                							if( body['state'] != true ){
                								pre.innerText = body['message'];
                							}

                						}).catch((e) => {
                							console.log("candleappstore: error in save items handler");
                							pre.innerText = e.toString();
                						});
					
					
                				  	});
                                    */
                                    
                                    
                                });
                            }
                            catch(e){
                                console.log("Error while creating domains list: ");
                                console.log(e);
                            }

                        }

                    });
                        
                        
                    
                    
                    
                    
					// Add delete button click event
					const clear_button = clone.querySelectorAll('.extension-candleappstore-item-clear-button')[0];
                    if(clear_button){
    					clear_button.addEventListener('click', (event) => {
                        
                            if (confirm('Delete/Reset the record of this device\'s activities? This will not affect which servers are blocked in the installedlist.')) {
                            
                                //console.log('Reset!');
                          
        						window.API.postJson(
        							`/extensions/candleappstore/api/ajax`,
        							{'action':'clear','mac':mac}
        						).then((body) => { 
        							//console.log("clear item reaction: ");
        							//console.log(body);
        							if( body['state'] != true ){
        								pre.innerText = body['message'];
        							}
                                    else{
                                        this.get_latest();
                                    }

        						}).catch((e) => {
        							console.log("candleappstore: error in clear device handler");
        							pre.innerText = e.toString();
        						});
                        
                            }
                        
                            /*
    						var target = event.currentTarget;
    						var parent3 = target.parentElement.parentElement.parentElement;
    						parent3.classList.add("delete");
    						var parent4 = parent3.parentElement;
    						parent4.removeChild(parent3);
    					    */
                        
    						// Send new values to backend

    				  	});
                    }
					
                    
                    
                    
					// Add delete button click event
					const delete_button = clone.querySelectorAll('.extension-candleappstore-item-delete-button')[0];
					delete_button.addEventListener('click', (event) => {
                        
                        if (confirm('Delete/Reset the record of this device\'s activities? This will not affect which servers are blocked in the installedlist.')) {
                            
                            //console.log('Reset!');
                          
    						window.API.postJson(
    							`/extensions/candleappstore/api/ajax`,
    							{'action':'delete','mac':mac}
    						).then((body) => { 
    							//console.log("delete item reaction: ");
    							//console.log(body);
    							if( body['state'] != true ){
    								pre.innerText = body['message'];
    							}
                                else{
                                    this.get_latest();
                                }

    						}).catch((e) => {
    							console.log("candleappstore: error in delete device handler");
    							pre.innerText = e.toString();
    						});
                        
                        }
                        
                        /*
						var target = event.currentTarget;
						var parent3 = target.parentElement.parentElement.parentElement;
						parent3.classList.add("delete");
						var parent4 = parent3.parentElement;
						parent4.removeChild(parent3);
					    */
                        
						// Send new values to backend

					
					
				  	});
                    
                    
					/*
					clone.classList.add('extension-candleappstore-type-' + type);
					//clone.querySelectorAll('.extension-candleappstore-type' )[0].classList.add('extension-candleappstore-icon-' + type);
					clone.querySelectorAll('.extension-candleappstore-sentence' )[0].innerHTML = sentence;

					var time_output = "";
				
				
					if( clock.seconds_to_go >= 86400 ){
					
						const month_names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
					
						time_output += '<div class="extension-candleappstore-date"><span class="extension-candleappstore-day">' + clock.day + '</span>';
						time_output += '<span class="extension-candleappstore-month">' + month_names[clock.month - 1] + '</span></div>';
						
					}

					
					var spacer = "";
					
					if(clock.hours < 10){spacer = "0";}
					time_output += '<div class="extension-candleappstore-short-time"><span class="extension-candleappstore-hours">' + spacer + clock.hours + '</span>';
				
					spacer = "";
					if(clock.minutes < 10){spacer = "0";}
					time_output += '<span class="extension-candleappstore-minutes">' + spacer + clock.minutes + '</span></div>';


					// Show time to go
					if( clock.seconds_to_go < 86400 ){
						
						time_output += '<div class="extension-candleappstore-time-to-go">'
						
						if( clock.seconds_to_go > 300 ){
							time_output += '<span class="extension-candleappstore-hours-to-go">' + Math.floor(clock.seconds_to_go / 3600) + '</span>';
						}
						time_output += '<span class="extension-candleappstore-minutes-to-go">' + Math.floor( Math.floor(clock.seconds_to_go % 3600)  / 60) + '</span>';
						if( clock.seconds_to_go <= 300 ){
							time_output += '<span class="extension-candleappstore-seconds-to-go">' + Math.floor(clock.seconds_to_go % 60) + '</span>';
						}
						time_output += '<span class="extension-candleappstore-to-go"> to go</span>';
						time_output += '</div>'

					}

					clone.querySelectorAll('.extension-candleappstore-time' )[0].innerHTML = time_output;
				    */
					document.getElementById('extension-candleappstore-list').append(clone);
				}); // end of looping over items
                
                this.sort_items("count");
			
			}
			catch (e) {
				// statements to handle any exceptions
				console.log(e); // pass exception object to error handler
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
    
            // Convert init to an RGBA
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


