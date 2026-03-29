(function() {
	class Candleappstore extends window.Extension {
	    constructor() {
	      	super('candleappstore');
			//console.log("Adding candleappstore addon to menu");
      		
            //console.log("candle store: window.API: ", window.API);
            
            
			this.addMenuEntry('App store');
			
			document.body.classList.add(location.protocol.replace(':',''));
			
            //const page = require('page');
            //console.log(page);
    
            this.debug = false;
            
	      	this.content = '';
            this.keyboard_listener_added = false;
			
            this.bits = 64; // or 64
			this.candle_version = '2.0.0';
			this.mayor_candle_version = 2;
            this.node_version = '12';
            this.python_version = '3.9';
            
            this.kiosk = false;
            this.developer = false;
            this.get_log_tail = false;
            this.exhibit_mode = false;
            this.log_poll_interval = null;
            this.current_page = "installed";
			this.developer_subtab = 'install'
            this.busy_log_polling = false;
			
			this.busy_polling = false;
			this.main_interval = null;
			this.last_main_poll_time = 0
            
            this.app_store_url = "https://www.candlesmarthome.com/extensions/appstore/";
            
            this.apps_overview = {};
            this.installed = []; // has data about folders in the addons folder. Comes from app store addon, and is then updated if addons are installed or uninstalled.
            this.cloud_app_data = []; // list of available apps, comes from the web via app store addon. #TODO: buffer this data locally to protect privacy
            this.api_addons_data = []; // has data about the settings of all addons, comes from gateway API.
            this.addons_to_update = []; // if adddons with new versions are spotted, their ID's will be added to this list.
            this.addons_being_installed = []; // contains names of addons in process of being installed, so that the install button can be hidden
            this.addon_dirs = []; // reflects actual directories on the disk
            this.extensions = []; // holds all the data about installed addons data that extend the UI (css and js files)
            this.addon_defaults = {}; // holds addon settings defaults, loaded via the addon api (not available through window.API)
            this.addon_sizes = {}; // holds sizes of addon directories on disk in bytes
            this.total_addons_size = null; // total combined size of all addons
            this.free_disk_space = null;
            this.free_memory = null;
            this.available_memory = null;
            this.extensions_list = [];
            this.selector = "";
            this.username = "";
            this.permissions = {};
            this.received_cloud_data = false;
            this.updating_all = false;
			this.jump_to_addon = '';
			this.jump_to_addon_settings = '';
			this.content_el = null;
			
			this.installing_addons_queue = {};
			this.busy_installing_addon = null;
			
			// Developer tab
			this.all_things = {};
			
			this.last_versions_allowed_for_candle_v2 = {};
			this.addons_with_newer_versions_on_latest_candle = {};
            
            this.selected_overlay_closed = false; // if a user clicks on an addon, but immediately navigates back, the overlay would normally still be loaded once the data is received
            // TODO: it would be nicer if the overlay could immediately show some minimal data already, while it loads in the rest
            
            this.not_shown_addons_list = [];
            this.pre_release_addons = {};
			
			this.add_things_button_listener_added = false;
			
			fetch(`/extensions/${this.id}/views/content.html`)
	        .then((res) => res.text())
	        .then((text) => {
	         	this.content = text;
				//location.protocol + '//' + location.host + location.pathname
	  		 	if( location.pathname.endsWith("extensions/candleappstore") ){
					//console.log(document.location.href);
	  		  		this.show();
					
					var show_addon = '';
					//console.log("window.location.search: ", window.location.search);
					if(window.location.search.indexOf('addon=') != -1){
						this.jump_to_addon = new URL(location.href).searchParams.get('addon');
						//console.log("should show this addon: ", this.jump_to_addon);
					}
					
	  		  	}
	        })
	        .catch((err) => console.error('candle store: failed to fetch content:', err));
            
            if(document.getElementById('virtualKeyboardChromeExtension') != null){
                document.body.classList.add('kiosk');
                this.kiosk = true;
            }
            
			
			//console.error("document.getElementById('addon-settings-link'): ", document.getElementById('addon-settings-link'));
			
			/*
			document.getElementById('addon-settings-link').href = '/extensions/candleappstore';
			
			document.getElementById('addon-settings-link').addEventListener('mousedown', (event) => {
				console.log("redirecting addon settings to Candle app store");
				if(!document.body.classList.contains('developer')){
					event.preventDefault();
					
					addon_settings_redirect_el = document.createElement('a');
					addon_settings_redirect_el.href = '/extensions/candleappstore';
					addon_settings_redirect_el.click();
				}
			});
			*/
			
            
			
			document.getElementById('addon-settings-link').href = '/extensions/candleappstore';
			
            //document.getElementById('installed-addons-list').style.display = 'none';
            document.getElementById('addon-main-settings').innerHTML += '<div id="extension-candleappstore-addons-page-redirect"><a href="/extensions/candleappstore" class="text-button">Return to Candle app store</a></div>';
            
            
            //console.log("local storage JWT: ", localStorage.getItem('jwt'));
                        
            if(document.getElementById('add-adapters-hint-anchor')){
            	document.getElementById('add-adapters-hint-anchor').href = '/extensions/candleappstore';
            }
            //else{
            //	console.warn("candle store: add-adapter-hin-anchor does not exist");
            //}
            
			
            window.API.getInstalledAddons()
            .then((result) => { 
				if(this.debug){
					console.log("candle store debug: get_installed_addons_data:  result: ", result);
				}
				
				result.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : -1) // sort alphabetically
				//console.log("sorted result: ", result);
                this.api_addons_data = result;
				this.generate_settings_addons_list();
			
			})
			.catch((err) => {
				console.error("candle store: caught error calling window.API.getInstalledAddons: ", err);
			})
			
			
            //
            // PRE-INIT
            //
			window.API.postJson(
				`/extensions/candleappstore/api/ajax`,
				{'action':'init'}
			)
            .then((body) => {
                
                // Debug?
                if(typeof body.debug == 'boolean'){
                    this.debug = body.debug;
                }
                
                if(this.debug){
                    console.log("candle store debug: INIT response: ", body);
                }
                
                // Received data from Candle server?
				if( body['state'] != true ){
                    console.error('candleappstore: failed to get proper init data? state was false.');
				}
                
                // Show developer options
                if(typeof body.developer != 'undefined'){
                    if(body.developer){
                        /*
                        if(document.getElementById('authorization-settings-link') != null){
                            document.getElementById('authorization-settings-link').style.display = 'block';
                            document.getElementById('experiment-settings-link').style.display = 'block';
                            document.getElementById('developer-settings-link').style.display = 'block';
                        }
                        */
                        if(!this.exhibit_mode){
                            document.body.classList.add('developer');
                        }
                        
                        this.get_log_tail = true;
                    }
                    
                    // this allows it to be set outside of this addon's developer setting too
                    if(document.body.classList.contains('developer')){
                        this.developer = true;
                        if(this.debug){
                            console.log("Candle store debug: early init: developer mode enabled");
                        }
                    }
                }
                
				
                //this.generate_installed( body['installed'] );
                //console.log("installed according to python: ", this.installed);
				
                
                // Parse most of the data
                this.parse_body(body);
                
                
                // Make sure menu button is always visible. Can be hidden if the user returns from a complex addon settings page using their browser's back button.
                //document.getElementById('menu-button').classList.remove('hidden');
                if(this.debug){
					console.log("candle store debug: developer: ", this.developer);
				}
				if(this.developer){
					setTimeout(() => {
						if(document.getElementById('extension-candleappstore-settings-menu-hint') == null){
							let addon_settings_hint = document.createElement('div');
							addon_settings_hint.setAttribute('id','extension-candleappstore-settings-menu-hint');
							//addon_settings_hint.classList.add('extension-candleappstore-vlak');
							addon_settings_hint.innerHTML = '<a href="/settings/addons">Classic addons settings</a>';
							document.getElementById('settings-menu').appendChild(addon_settings_hint);
						}
					},2000);
                }
				else{
					let addon_settings_link_el = document.getElementById('addon-settings-link');
					if(addon_settings_link_el){
						if(addon_settings_link_el.src == '/settings/addons'){
							addon_settings_link_el.src = '/extensions/candleappstore';
						}
					}
				}
				
				let addon_settings_link_el = document.getElementById('addon-settings-link');
				if(addon_settings_link_el){
					addon_settings_link_el.parentNode.classList.add('extension-candleappstore-hidden');
				}
			
				
			})
            .catch((err) => {
				console.error("candle store: caught error in early call to init: ", err);
			});
			
			
			
			this.main_interval = setInterval(() => {
				this.do_interval()
			},5000);
            
	    }



		do_interval(){
			if(this.debug){
				console.log("candle store debug: in do_interval");
			}
			if( this.busy_polling == false && (this.last_main_poll_time == 0 || window.location.pathname.startsWith("/extensions/candleappstore")) ){
				this.last_main_poll_time = Date.now();
				this.busy_polling = true
				window.API.postJson(
					`/extensions/candleappstore/api/ajax`,
					{'action':'main_poll'}
				)
	            .then((body) => {
		            if(this.debug){
		                console.log("Candle Store debug: main_poll response: ", body);
					}
					//console.warn("candle store: got show init response: ", body);
	                this.parse_body(body);
					this.busy_polling = false;
				})
	            .catch((err) => {
					if(this.debug){
						console.error("candle store debug: caught error calling main_poll: ", err);
					}
					this.busy_polling = false;
				});
				
			}
			else{
				if(this.debug){
					console.log("candle store debug: no attempting a poll.  this.busy_polling, window.location.pathname: ", this.busy_polling, window.location.pathname);
				}
			}
			
		}



        // A single place to parse various Api responses
        parse_body(body){
            
            // Debug?
            if(typeof body.debug != 'undefined'){
                this.debug = body.debug;
            }
            
            if(this.debug){
                console.log("Candle Store debug: INIT response: ", body);
            }
            
            if(typeof body.exhibit_mode == 'boolean'){
                this.exhibit_mode = body.exhibit_mode;
                if(this.exhibit_mode){
                    document.body.classList.add('exhibit-mode');
                }
            }
            
            if(typeof body['app_store_url'] == 'string'){
            	this.app_store_url = body['app_store_url'];
            }
			
			if(typeof body['installed'] != 'undefined'){
				this.installed = body['installed'];
			}
			
            if(typeof body['permissions'] != 'undefined'){
                this.permissions = body['permissions'];
			}
			
            if(typeof body['candle_version'] == 'string' && body['candle_version'].indexOf('.') != -1){
                this.candle_version = body['candle_version'];
				this.mayor_candle_version = parseInt(this.candle_version.split('.')[0]);
			}
            if(typeof body['last_versions_allowed_for_candle_v2'] != 'undefined' && body['last_versions_allowed_for_candle_v2'] != null){
                this.last_versions_allowed_for_candle_v2 = body['last_versions_allowed_for_candle_v2'];
			}
			
			
            // Show the available memory. This is different from "free" memory
            if(typeof body['available_memory'] == 'number' && typeof body['total_memory'] == 'number' && typeof body['free_memory'] == 'number'){
                 // Show the free memory.
                
                //if(body.total_memory < 1600){
                //    document.getElementById('extension-canleappstore-low-memory-hint').style.display = 'block';
                //}
                
				let total_mem = parseFloat(body['total_memory']);
				let avail_mem = Math.floor(parseFloat(body['available_memory']) / 1000);
				let free_mem = parseFloat(body['free_memory']);
				
				const available_memory_mb = Math.round(this.available_memory/1000);
				
				
				const total_memory_el = this.view.querySelector('#extension-candleappstore-total-memory');
                if(total_memory_el){
					if(body['total_memory'] > 3000){
						total_memory_el.textContent = Math.round(body['total_memory']/1000) + " GB ";
					}else{
						total_memory_el.textContent = body['total_memory'] + "MB ";
					}
					
					this.view.querySelector('#extension-candleappstore-used-memory').textContent = Math.round(total_mem - avail_mem);
					this.view.querySelector('#extension-candleappstore-available-memory').textContent = Math.round(avail_mem - free_mem);
					this.view.querySelector('#extension-candleappstore-free-memory').textContent = body['free_memory'];
                }
				
               
				
				
				/*
				let low_mem_el = document.getElementById('extension-candleappstore-low-memory-warning');
			
				if(low_mem_el){
                    if(free_mem < 100){
                        low_mem_el.style.display = 'block';
                    }
                    if(free_mem < 50){
                        low_mem_el.style.background = 'red';
                    }
				}
				*/
				
				
				let used_mem = ( (total_mem - avail_mem) / total_mem) * 100;
				if(this.debug){
					console.log("candle store debug: used_mem: ", used_mem);
				}
				let purgeable_mem = ( (avail_mem - free_mem) / total_mem) * 100;
				if(this.debug){
					console.log("candle store debug: purgeable_mem: ", purgeable_mem);
				}
				const memory_used_bar_el = this.view.querySelector('#extension-candleappstore-memory-used-bar');
				if(memory_used_bar_el){
					memory_used_bar_el.style.width = used_mem + '%';
					this.view.querySelector('#extension-candleappstore-memory-purgeable-bar').style.width = purgeable_mem + '%';
				}
            }
			
            // Show developer options
            if(typeof body.developer == 'boolean' && !this.exhibit_mode){
                if(body.developer){
                    document.body.classList.add('developer');
                }
                if(document.body.classList.contains('developer')){
                    this.developer = true;
                    console.log("candle store debug: body has developer class");
                }
            }
			
            if(typeof body.bits != 'undefined'){
                this.bits = parseInt(body.bits);
                if(this.debug){
                    console.log("candle store debug: system bits: ", this.bits);
                }
            }
            if(typeof body.python_version != 'undefined'){
                this.python_version = body.python_version;
                if(this.debug){
                    console.log("candle store debug: python_version: ", this.python_version);
                }
            }
            if(typeof body.node_version != 'undefined'){
                this.node_version = body.node_version;
                if(this.debug){
                    console.log("candle store debug: node_version: ", this.node_version);
                }
            }
            if(typeof body.addon_defaults != 'undefined'){
                this.addon_defaults = body.addon_defaults;
                if(this.debug){
                    console.log("candle store debug: addon_defaults: ", this.addon_defaults);
                }
            }
            if(typeof body.addon_sizes != 'undefined'){
                this.addon_sizes = body.addon_sizes;
                if(this.debug){
                    console.log("candle store debug: addon_sizes: ", this.addon_sizes);
                }
            }
            if(typeof body.total_addons_size != 'undefined'){
                this.total_addons_size = body.total_addons_size;
                if(this.debug){
                    console.log("candle store debug: total_addons_size: ", this.total_addons_size);
                }
            }
            if(typeof body.free_disk_space != 'undefined'){
                this.free_disk_space = body.free_disk_space;
                if(this.debug){
                    console.log("candle store debug: free_disk_space: ", this.free_disk_space);
                }
            }
            if(typeof body.free_memory == 'number'){ // Not currently used
                this.free_memory = body.free_memory;
                if(this.debug){
                    console.log("candle store debug: free_memory: ", this.free_memory);
                }
            }
            if(typeof body.available_memory == 'number'){
                this.available_memory = body.available_memory;
                if(this.debug){
                    console.log("candle store debug: available_memory: ", this.available_memory);
                }
            }
			
			if(typeof body['pre_release_addons'] != 'undefined'){
				this.pre_release_addons = body['pre_release_addons'];
                if(this.debug){
                    console.log("candle store debug: this.pre_release_addons: ", this.pre_release_addons);
                }
			}
            
			
			const tab_button_shop_el = this.view.querySelector('#extension-candleappstore-tab-button-shop');
            if(tab_button_shop_el){
				if(tab_button_shop_el.classList.contains('extension-candleappstore-hidden')){
	                tab_button_shop_el.classList.remove('extension-candleappstore-hidden');
	                this.view.querySelector('#extension-candleappstore-tab-button-updates').classList.remove('extension-candleappstore-hidden');
				}
            }
			
            // UPDATE UI BASED ON UPDATED VALUES
            
			if(!this.content_el){
				this.content_el = this.view.querySelector('#extension-candleappstore-content');
			}
			
			if(this.content_el){
				
				const disk_space_el = this.view.querySelector('#extension-candleappstore-disk-space');
	            if(disk_space_el){
	                // Update low disk space class
	                //console.log("this.free_disk_space: ", this.free_disk_space);
	                try{
                
	                    if(this.free_disk_space != null && this.total_addons_size != null){
                    
                    
	                        const available_disk_mb = Math.round(this.free_disk_space/1000);
	                        const addons_size_mb = Math.round(this.total_addons_size/1000);
                    
	                        disk_space_el.innerHTML = '<div><div id="extension-candleappstore-low-disk-space-hint">Warning, the disk is getting full</div>Total addons size: ' + addons_size_mb + 'Mb<br/>Available disk space: ' + available_disk_mb + 'Mb</div>';
	                        if(this.debug){
	                            console.log("candle store debug: available disk space in Mb: ", available_disk_mb);
	                        }
	                        if(this.free_disk_space < 1000000){ // less than a gigabyte of space remaning
	                            if(this.debug){
	                                console.log("candle store debug: low disk space");
	                            }
	                            this.content_el.classList.add('extension-candleappstore-low-disk-space');
	                        }
	                        else{
	                            if(this.debug){
	                                console.log("candle store debug: enough disk space");
	                            }
	                            this.content_el.classList.remove('extension-candleappstore-low-disk-space');
	                        }
                    
	                    }
                
	                }
	                catch(err){
	                    if(this.debug){
							console.error("candle store debug: caught error checking/setting low disk space indicator class: ", err);
						}
	                }
            
            
	                // Update low memory indicator
	                //console.log("this.available_memory: ", this.available_memory);
	                try{
                
	                    if(this.available_memory != null){
                    
	                        const available_memory_mb = Math.round(this.available_memory/1000);
                    	
	                        //document.getElementById('extension-candleappstore-overview-available-memory').innerText = 'Available memory: ' + available_memory_mb + 'Mb';
	                        const install_total_memory_el = this.view.querySelector('#extension-candleappstore-install-available-memory')
							if(install_total_memory_el){
								install_total_memory_el.innerText = 'Available memory: ' + available_memory_mb + 'Mb';
								this.view.querySelector('#extension-candleappstore-store-available-memory').innerText = 'Available memory: ' + available_memory_mb + 'Mb';
							}
						
	                        if(this.debug){
	                            console.log("candle store debug: available memory in Mb: ", available_memory_mb );
	                        }
	                        if(this.available_memory < 250000){ // less than 250Mb remaining
	                            if(this.debug){
	                                console.log("candle store debug: low memory.");
	                            }
	                            this.content_el.classList.add('extension-candleappstore-low-memory');
                        
	                            // Very low memory, less than 100mb
	                            if(this.available_memory < 100000){
	                                if(this.debug){
	                                    console.log("candle store debug: VERY low memory.");
	                                }
	                                this.content_el.classList.add('extension-candleappstore-very-low-memory');
	                            }
	                            else{
	                                this.content_el.classList.remove('extension-candleappstore-very-low-memory');
	                            }
	                        }
	                        else{
	                            if(this.debug){
	                                console.log("candle store debug: enough available memory");
	                            }
	                            this.content_el.classList.remove('extension-candleappstore-low-memory');
	                            this.content_el.classList.remove('extension-candleappstore-very-low-memory');
	                        }
                    
	                    }
                
	                }
	                catch(err){
						if(this.debug){
	                    	console.error("candle store debug: caught error checking/setting low disk space indicator class: ", err);
						}
	                }
	            }
				
				
				
				if(typeof body.installing_addons_queue != 'undefined' && typeof body.busy_installing_addon != 'undefined'){
					this.installing_addons_queue = body.installing_addons_queue;
					this.busy_installing_addon = body.busy_installing_addon;
					this.generate_installing_overview();
				}
				
			}
			
            
            
        }


		generate_installing_overview(){
			if(this.debug){
				console.log("candle store debug: in generate_installing_overview.  this.busy_installing_addon: ", this.busy_installing_addon);
			}
			
			const installing_keys_list = Object.keys( this.installing_addons_queue );
			const installing_overview_el = this.view.querySelector('#extension-candleappstore-installing-overview-container');
			
			if(installing_keys_list.length){
				if(this.debug){
					console.log("candle store debug: generate_installing_overview:  this.installing_addons_queue: \n", this.installing_addons_queue);
				}
				
				if(installing_overview_el){
				
				
					let currently_installing_el = installing_overview_el.querySelector('#extension-candleappstore-currently-installing');
					if(!currently_installing_el){
						currently_installing_el = document.createElement('div');
						currently_installing_el.setAttribute('id','extension-candleappstore-currently-installing');
						installing_overview_el.prepend(currently_installing_el);
					}
					if(currently_installing_el){
						if(typeof this.busy_installing_addon == 'string'){
							currently_installing_el.textContent = 'Currently installing: ' + this.busy_installing_addon;
						}
						else{
							currently_installing_el.textContent = '';
						}
					}
				
					for (const [addon_id, details] of Object.entries( this.installing_addons_queue )) {
					
						let addon_item_el = installing_overview_el.querySelector('#extension-candleappstore-installing-overview-' + addon_id);
						if(!addon_item_el){
							addon_item_el = document.createElement('div');
							addon_item_el.setAttribute('id','extension-candleappstore-installing-overview-' + addon_id);
						
							const addon_item_title_el = document.createElement('span');
							addon_item_title_el.textContent = addon_id;
							addon_item_el.appendChild(addon_item_title_el);
						
							const addon_item_progress_el = document.createElement('span');
							addon_item_progress_el.innerHTML = '<div class="extension-candleappstore-installing-item-progress-bar-container"><div class="extension-candleappstore-installing-item-progress-bar"></div></div><div class="extension-candleappstore-installing-item-message"></div>';
							addon_item_el.appendChild(addon_item_progress_el);
						
							installing_overview_el.appendChild(addon_item_el);
						}
						if(addon_item_el){
							const addon_item_message_el = addon_item_el.querySelector('.extension-candleappstore-installing-item-message');
							if(addon_item_message_el && typeof details.message == 'string'){
								addon_item_message_el.textContent = details.message;
							}
						
							if(typeof details.download_size == 'number' && details.download_size > 0 && typeof details.downloaded_size == 'number'){
								const addon_progress_bar_el = addon_item_el.querySelector('.extension-candleappstore-installing-item-progress-bar');
								if(addon_progress_bar_el){
								
									let download_percentage = 0;
									if(details.downloaded_size <= details.download_size){
										download_percentage = Math.floor( ((details.downloaded_size / details.download_size) * 1000) / 10);
										console.log("download_percentage: ", download_percentage);
										if(download_percentage < 0){
											download_percentage = 0;
										}
										else if(download_percentage > 100){
											download_percentage = 100;
										}
										addon_progress_bar_el.style.width = download_percentage  + '%';
									}
								
								}
							}
						
						}
					}
					
				}
			}
			else{
				installing_overview_el.innerHTML = '';
			}
			
		}

		


		
		generate_settings_addons_list(){
			//console.log("in generate_settings_addons_list.  this.api_addons_data: ", this.api_addons_data);
			if(this.api_addons_data){
				
				let settings_menu_addons_list_el = document.querySelector('#extension-candleappstore-settings-menu-addons-list');
				if(settings_menu_addons_list_el == null){
					const settings_menu_el = document.querySelector('#settings-menu');
					if(settings_menu_el){
						settings_menu_addons_list_el = document.createElement('ul');
						settings_menu_addons_list_el.innerHTML = '<a href="/extensions/candleappstore"><h1>Addons</h1></a>';
						settings_menu_addons_list_el.setAttribute('id','extension-candleappstore-settings-menu-addons-list');
						settings_menu_el.appendChild(settings_menu_addons_list_el);
					}
					
				}
				
				if(settings_menu_addons_list_el){
					//console.log("settings addons menu list (now) exists.  this.api_addons_data: ", this.api_addons_data);
					for(let a = 0; a < this.api_addons_data.length; a++){
						const addon = this.api_addons_data[a];
						let addon_list_el = document.createElement('li');
						addon_list_el.classList.add('settings-item');
						
						let addon_link_el = document.createElement('a');
						addon_link_el.textContent = addon.name;
						addon_link_el.addEventListener('click', () => {
							//console.log("should show settings for: ", addon.id);
							const candle_store_main_menu_button_el = document.getElementById('extension-candleappstore-menu-item');
							if(candle_store_main_menu_button_el){
								candle_store_main_menu_button_el.click();
								let maximum_loops=40;
								const try_showing_addon_settings = () => {
									//console.log("maximum_loops: ", maximum_loops);
									const candle_app_store_selected_addon_overlay_el = document.getElementById('extension-candleappstore-selected');
		                            if(candle_app_store_selected_addon_overlay_el){
		                            	candle_app_store_selected_addon_overlay_el.style.display = 'none';
										this.show_addon_config(addon.id);
		                            }
									else{
										maximum_loops--;
										if(maximum_loops > 0){
											setTimeout(try_showing_addon_settings,20);
										}
									}
								}
								setTimeout(try_showing_addon_settings,10);
							}
						})
						//addon_link_el.setAttribute('href','/extensions/candleappstore#' + this.api_addons_data[a].id);
						addon_link_el.style.backgroundImage = 'url(/extensions/' + this.api_addons_data[a].id + '/images/menu-icon.svg)'
						addon_list_el.appendChild(addon_link_el);
						
						settings_menu_addons_list_el.appendChild(addon_list_el);
					}
				}
				
			}
		}




        // Compares the data from the internal API with the cloud data
        check_for_updates(){
            if(this.debug){
                console.log("candle store debug: in check_for_updates. this.cloud_app_data and this.api_addons_data: ", this.cloud_app_data, this.api_addons_data);
            }
			
            
            if(this.cloud_app_data.length > 0 && this.api_addons_data.length > 0){
                if(this.debug){
                    console.log("candle store debug: - both API and Cloud data arrays had non-zero length");
                }
                
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
                                let cloud_version_int = (parseInt(this.cloud_app_data[u]['mayor_version']) * 1000000) + (parseInt(this.cloud_app_data[u]['meso_version']) * 1000) + parseInt(this.cloud_app_data[u]['minor_version']);
                                
                                //console.log("local and cloud version ints : ", local_version_int, cloud_version_int);
                                
								if(!this.candle_version.startsWith('3.') && !this.candle_version.startsWith('4.')){
									if(typeof this.last_versions_allowed_for_candle_v2[this.api_addons_data[i].id] == 'number' && cloud_version_int > this.last_versions_allowed_for_candle_v2[this.api_addons_data[i].id]){
										this.addons_with_newer_versions_on_latest_candle[this.api_addons_data[i].id] = this.last_versions_allowed_for_candle_v2[this.api_addons_data[i].id];
						                if(this.debug){
						                    console.log("candle store debug: restricting maximum allowed version for Candle 2.X.X from " + cloud_version_int + " to " + this.last_versions_allowed_for_candle_v2[this.api_addons_data[i].id]);
						                }
										cloud_version_int = this.last_versions_allowed_for_candle_v2[this.api_addons_data[i].id];
									}
								}
								
                                if(cloud_version_int > local_version_int){
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
                    catch(err){
                        if(this.debug){
							console.log("candle store debug: caught error looping over cloud data for find updates: ", err);
						}
                    }
                
                }
                
                if(this.addons_to_update.length > 0){
                    if(this.debug){
                        console.log("candle store debug: addons with updates: ", this.addons_to_update);
                    }
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
                if(this.debug){
                    console.error("candle store debug: check for updates: one of the two data sources is empty:");
					console.log("candle store debug: - this.cloud_app_data: ", this.cloud_app_data);
					console.log("candle store debug: - this.api_addons_data: ", this.api_addons_data);
                }
            }
            
            
        }

        
        
        
        
        // Returns a single item from the large cloud data list of addons. It does not have details.
        get_cloud_addon_data(desired_addon_id){
            if(this.debug){
                console.log("candle store debug: in get_cloud_addon_data. this.cloud_app_data: ", this.cloud_app_data);
                console.log("candle store debug: get_cloud_addon_data is looking for: ", desired_addon_id);
            }
            
            var found_package = false; // becomes true if a matching package is found in packages list
            
            //console.log("this.cloud_app_data.length: ",  this.cloud_app_data.length );
            //console.log("keys length: ",  Object.keys(this.cloud_app_data).length );
            
            if(this.cloud_app_data.length > 0){
                
                //const cloud_keys = Object.keys(this.cloud_app_data);
                
                for(let i = 0; i < this.cloud_app_data.length; i++){
                    //console.log(i, this.cloud_app_data[i]);
                    const item = this.cloud_app_data[i];
                    //console.log(item.addon_id);
                    if(item.addon_id == desired_addon_id){
                        if(this.debug){
                            console.log("candle store debug: get_cloud_addon_data: found the matching addon");
                        }
                        
                        // Try gettting the optimal downlood for this architecture and putting it in place of the old data
                        try{
                            if(typeof item.packages != 'undefined'){
                            
                                if(item.packages == null){
                                    if(this.debug){
										console.error('candle store debug: item.packages was empty, no download candidate');
									}
                                    continue;
                                }
                                
                                var packs = item.packages;
                                if(typeof item.packages == 'string'){
                                    packs = JSON.parse(item.packages);
                                    if(this.debug){
                                        console.warn("candle store debug: item.packages was a string. Probably old cached data.");
                                    }
                                }
                                
                                if(this.debug){
                                    console.log("candle store debug: get_cloud_addon_data: packages spotted: ", packs);
                                }
                                
                                var system_architecture = 'linux-arm';
                                if(this.bits == 64){
                                    system_architecture = 'linux-arm64';
                                }
                                if(this.debug){
                                    console.log("candle store debug: get_cloud_addon_data: system_architecture: ", system_architecture);
                                }
                                
                                if(packs.length == 0){
                                    if(typeof item.download_url != 'undefined' && typeof item.checksum != 'undefined'){
                                        if(this.debug){
                                            console.warn("candle store debug: packages list was empty, but there is still a download_url in the item: ", item);
                                        }
                                        return item;
                                    }
                                    else{
                                        if(this.debug){
                                            console.warn("candle store debug: packages list was empty, and also no download_url in the item: ", item);
                                        }
                                        return null;
                                    }
                                    
                                    
                                }
                                else if(packs.length == 1){
                                    if(this.debug){
                                        console.log("candle store debug: only one package available");
                                    }
                                    if(typeof packs[0]['url'] != 'undefined' || typeof packs[0]['checksum'] != 'undefined'){
                                        item['download_url'] = packs[0]['url'];
                                        item['checksum'] = packs[0]['checksum'];
                                        if(this.debug){
                                            console.log("candle store debug: download URL and checksum set to only available version:", item['download_url'], item['checksum']);
                                        }
                                        found_package = true;
                                    }
                                }
                                else{
                                    
                                    // check if any arm64 packages are available
                                    let arm64_available = false; // only set to true if the system is itself also 64 bits. If true, it means we hold out for a 64 bit version of a package.
                                    let language = 'nodejs';
                                    let python39_available = false;
                                    let python311_available = false;
									let python313_available = false;
                                    let node12_available = false;
                                    let node18_available = false;
									let node20_available = false;
                                    for(let p = 0; p < packs.length; p++){
                                        if(typeof packs[p]['architecture'] != 'undefined'){
                                            if(this.bits == 64){
                                                if(packs[p]['architecture'] == 'linux-arm64'){
                                                    if(this.debug){
                                                        console.log("candle store debug: linux-arm64 package spotted");
                                                    }
                                                    arm64_available = true;
                                                }
                                            }
                                            if(packs[p]['architecture'] == system_architecture){
                                                if(typeof packs[p]['language'] != 'undefined'){
                                                    if(typeof packs[p]['language']['name'] != 'undefined'){
                                                        language = packs[p]['language']['name'];
                                                    }
                                                    if(typeof packs[p]['language']['versions'] != 'undefined'){
                                                        for(let v = 0; v < packs[p]['language']['versions'].length; v++){
                                                            if(this.python_version == '3.9' && packs[p]['language']['versions'][v] == '3.9'){
                                                                if(this.debug){
                                                                    console.log("candle store debug: python 3.9 package spotted");
                                                                }
                                                                python39_available = true;
                                                            }
                                                            if(this.python_version == '3.13' && packs[p]['language']['versions'][v] == '3.13'){
                                                                if(this.debug){
                                                                    console.log("candle store debug: python 3.13 package spotted");
                                                                }
                                                                python313_available = true;
                                                            }
                                                            if(this.python_version == '3.13' && packs[p]['language']['versions'][v] == '3.11'){
                                                                if(this.debug){
                                                                    console.log("candle store debug: python 3.11 package spotted");
                                                                }
                                                                python311_available = true;
                                                            }
                                                            if(this.python_version == '3.13' && packs[p]['language']['versions'][v] == '3.9'){
                                                                if(this.debug){
                                                                    console.log("candle store debug: python 3.9 package spotted");
                                                                }
                                                                python39_available = true;
                                                            }
															
                                                            if(this.python_version == '3.11' && packs[p]['language']['versions'][v] == '3.11'){
                                                                if(this.debug){
                                                                    console.log("candle store debug: python 3.11 package spotted");
                                                                }
                                                                python311_available = true;
                                                            }
                                                            if(this.python_version == '3.11' && packs[p]['language']['versions'][v] == '3.9'){
                                                                if(this.debug){
                                                                    console.log("candle store debug: python 3.9 package spotted");
                                                                }
                                                                python39_available = true;
                                                            }
															
                                                            if(this.python_version == '3.9' && packs[p]['language']['versions'][v] == '3.9'){
                                                                if(this.debug){
                                                                    console.log("candle store debug: python 3.9 package spotted");
                                                                }
                                                                python39_available = true;
                                                            }
															
                                                            if(packs[p]['language']['versions'][v] == '12'){
                                                                if(this.debug){
                                                                    console.log("candle store debug: node 12 package spotted");
                                                                }
                                                                node12_available = true;
                                                            }
                                                            if(this.node_version == '18' && packs[p]['language']['versions'][v] == '18'){
                                                                if(this.debug){
                                                                    console.log("candle store debug: node 18 package spotted");
                                                                }
                                                                node18_available = true;
                                                            }
                                                            if(this.node_version == '20' && packs[p]['language']['versions'][v] == '20'){
                                                                if(this.debug){
                                                                    console.log("candle store debug: node 20 package spotted");
                                                                }
                                                                node20_available = true;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    
                                    for(let p = 0; p < packs.length; p++){
                                        if(typeof packs[p]['architecture'] != 'undefined'){
                                            if(packs[p]['architecture'] == system_architecture || arm64_available == false){ // if arm64 is not avaiable, then a 32 bit package will have to do
                                                if(this.debug){
                                                    console.log("candle store debug: get_cloud_addon_data: found useful package");
                                                }
                                                if(typeof packs[p]['url'] != 'undefined' && typeof packs[p]['checksum'] != 'undefined'){
                                                    
                                                    if(this.python_version != '3.7' && (python39_available || python311_available || python313_available) && packs[p]['url'].indexOf('3.7.tgz') != -1){ // TODO: should now check the url, but should properly check the package's languages data instead
                                                        if(this.debug){
                                                            console.log("candle store debug: skipping python 3.7 version because a newer version is known to be available");
                                                        }
                                                        continue;
                                                    }
                                                    
                                                    if(this.python_version == '3.13' && python313_available && packs[p]['url'].indexOf('3.9.tgz') != -1){ // TODO: should now check the url, but should properly check the package's languages data instead
                                                        if(this.debug){
                                                            console.log("candle store debug: skipping python 3.9 version because a 3.13 version is known to be available");
                                                        }
                                                        continue;
                                                    }
                                                    if(this.python_version == '3.13' && python313_available && packs[p]['url'].indexOf('3.11.tgz') != -1){ // TODO: should now check the url, but should properly check the package's languages data instead
                                                        if(this.debug){
                                                            console.log("candle store debug: skipping python 3.9 version because a 3.11 version is known to be available");
                                                        }
                                                        continue;
                                                    }
													
                                                    if(this.python_version == '3.11' && python311_available && packs[p]['url'].indexOf('3.9.tgz') != -1){ // TODO: should now check the url, but should properly check the package's languages data instead
                                                        if(this.debug){
                                                            console.log("candle store debug: skipping python 3.9 version because a 3.11 version is known to be available");
                                                        }
                                                        continue;
                                                    }
                                                    
                                                    
                                                    // TODO: node prefered version checking. It should generally prefer version 12.
                                                    if(node12_available && packs[p]['url'].indexOf('v12') == -1){
                                                        if(this.debug){
                                                            console.log("candle store debug: A node 12 version is available, but this is not it. Skipping.");
                                                        }
                                                        continue;
                                                    }
													
                                                    if(node20_available && packs[p]['url'].indexOf('v18') != -1){
                                                        if(this.debug){
                                                            console.log("candle store debug: A node 20 version is available, but this is not it. Skipping.");
                                                        }
                                                        continue;
                                                    }
                                                    
                                                    item['download_url'] = packs[p]['url'];
                                                    item['checksum'] = packs[p]['checksum'];
                                                    if(this.debug){
                                                        console.log("candle store debug: download URL and checksum set to optimal versions:", item['download_url'], item['checksum']);
                                                    }
                                                    found_package = true;
                                                    break;
                                                }
                                                else{
                                                    if(this.debug){
														console.error("candle store debug: candle store: url or checksum was missing in packages item: ", item);
													}
                                                }
                                            
                                            }
                                        }
                                    }
                                }
                                
                            }
                            
                        }
                        catch(err){
                            if(this.debug){
								console.error("candle store debug: error while finding optimal package: ", err);
							}
                        }
                        
                        if(this.debug){
                            console.log("candle store debug: get_cloud_addon_data: returning this item: ", item);
                            console.log("candle store debug: found_package?", found_package);
                        }
                        
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
                if(this.debug){
					console.warn("candle store debug: no cloud data available (yet)");
				}
            }
            if(this.debug){
                console.log("candle store debug: found_package?", found_package);
            }
            return null;
        }




		hide() {
			try{
				clearInterval(this.log_poll_interval);
                this.log_poll_interval == null
				//console.log("interval cleared");
			}
			catch(e){
				//console.log("no interval to clear? " + e);
			}
            
		}
		



	    show() {
			if(this.debug){
                console.log("candle store debug: show called");
            }
			
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
            
            

            // get a z-index above the main menu button while overlay with back button is active
            this.view.style.zIndex = 'auto';
            
            
			try{
				if(this.log_poll_interval){
					clearInterval(this.log_poll_interval);
	                this.log_poll_interval == null
				}
			}
			catch(err){
				console.error("candle store: show: caught error clearning interval: ", err);
			}
            
            
			document.getElementById('menu-button').classList.remove('hidden'); // TODO: not optimal to manipulate the surrounding interface like this.
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
				if(this.debug){
	                console.log("candle store debug: show: content was still empty");
	            }
				return;
			}
			else{
				//document.getElementById('extension-candleappstore-view')#extension-candleappstore-view
                this.view.innerHTML = this.content;
			}
			
            // try to restore search filter preferences
            try{
                if (localStorage.getItem("candle_store_filter_reviews") !== null) {
                    document.getElementById('extension-candleappstore-filter-reviews-select').value = localStorage.getItem("candle_store_filter_reviews");
                }
                if (localStorage.getItem("candle_store_filter_privacy") !== null) {
                    document.getElementById('extension-candleappstore-filter-privacy-select').value = localStorage.getItem("candle_store_filter_privacy");
                }
                if (localStorage.getItem("candle_store_filter_expert") !== null) {
                    document.getElementById('extension-candleappstore-filter-expert-select').value = localStorage.getItem("candle_store_filter_expert");
                }
			}
			catch(err){
				if(this.debug){
					console.error("candle store debug: failed to restore filter preference(s) from local storage: ", err);
				}
			}
            
            /*
            try{
                document.getElementById("extension-candleappstore-content").scrollIntoView();
            }
            catch(e){
                console.log("Error scrolling title into view: ", e);
            }
            */
            
            if(document.body.classList.contains('developer')){
                this.developer = true;
                if(this.debug){
                    console.log("Candle store debug: show: detected 'developer' class in body");
                }
            }
            else{
                if(this.debug){
                    console.log("candle store debug: show: did not detect 'developer' class in body");
                }
                this.developer = false;
            }
            
			
			
			if(window.location.hash.length > 1){
				this.jump_to_addon_settings = window.location.hash.replace('#','');
				if(this.debug){
					console.log("candle store debug: should show this addon's settings: ", this.jump_to_addon);
				}
				try{
					//history.replaceState({}, document.title, window.location.href.split('#')[0]);
					history.replaceState("", document.title, window.location.pathname); //  + window.location.search
				}catch(err){
					console.error("candle store: caught error removing hash from URL bar: ", err);
				}
	
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
				if(this.debug){
					console.log("candle store debug: show: window.API.getExtensions result: ", result);
				}
					
				//console.log(result);
                this.extensions = result;
                this.extensions_list = Object.keys(result);
			}).catch((err) => {
				if(this.debug){
					console.error("candle store debug: caught error in window.API.getExtensions: ", err);
				}
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
                this.selected_overlay_closed = true;
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
            
            
            
            // shortcut to the Power Settings system update page
            document.getElementById('extension-candleappstore-system-update-available-container').addEventListener('click', (event) => {
                setTimeout(() => {
                    if(document.getElementById('extension-candleappstore-container-update')){
						document.querySelectorAll('.extension-candleappstore-container').forEach( el => {
	                        el.classList.add('extension-candleappstore-hidden');
	                    });
	                    document.getElementById('extension-candleappstore-container-update').classList.remove('extension-candleappstore-hidden');
	                    document.getElementById('extension-candleappstore-pages').classList.remove('hidden');
                    }
                }, 500);
            });
            
			
			// Update the memory use bar by clicking on it
            document.getElementById('extension-candleappstore-available-memory-container').addEventListener('click', (event) => {
            	this.get_init();
            })
			
			
            
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
					if(this.debug){
						console.error("candle store: error logging out: ", e);
					}
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
                .catch((err) => {
					console.log("candle store: caught error while testing logged in state: ", err);
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
                    this.flash_message("The passwords didn't match");
                }
                
			});
            
            
            forgot_button.addEventListener('click', (event) => {
                //console.log("forgot password button clicked");
                forgot_button.style.display = 'none';
                const email = document.getElementById('extension-candleappstore-login-email').value;
                
                if(email != ""){
                    
                    const login_data = {
                        'action':'forgot_password',
                        'email':email
                    }
                
                    // Get data for apps overview
                    this.get_data("ajax.php",login_data)
                    .then(response => {
                        //console.log("FORGOT RESPONSE:");
                        //console.log(response);
                        //console.log("typeof response = " + typeof response);
                        
                        forgot_button.style.display = 'inline-block';
                        
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
                        
                    })
                    .catch(err => {
                        console.error("connecting to the candle server failed: ", err);
                        auth_response.innerText = "Connection error, please try again";
                        forgot_button.style.display = 'inline-block';
                    });
                    
                }
                else{
                    this.flash_message("Please enter a valid email address");
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
                    this.flash_message("The passwords didn't match");
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
                            this.flash_message("You are now logged in.")
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
                    this.flash_message("Please enter the verification code first");
                }
                
			});
            
            
            
            // Update all button
            document.getElementById("extension-candleappstore-update-all-button").addEventListener('click', (event) => {
                //console.log("update all button clicked");
                this.update_all();
            });
            
            // Go to "add things" screen when addon was just installed
            //
            if(this.add_things_button_listener_added == false){
            	document.getElementById('extension-candleappstore-post-install-settings-add-things-button').addEventListener('click', () =>{
            		//AddThingScreen.show.bind(AddThingScreen)
					setTimeout(() => {
						document.getElementById('add-button').click();
					},0);
					
            	});
            }
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
            
            document.getElementById('extension-candleappstore-developer-addon-url').addEventListener('change', (event) => {
                if(document.getElementById('extension-candleappstore-developer-addon-id').value == ""){
                    const url = document.getElementById('extension-candleappstore-developer-addon-url').value;
                    var url_parts = url.split("/");
                    document.getElementById('extension-candleappstore-developer-addon-id').value = url_parts[4];
                }
            });
            
            
            // Developer - manual addon install button
            document.getElementById("extension-candleappstore-developer-addon-install-button").addEventListener('click', (event) => {
                console.log("manual addon install button clicked");
                
                if(this.exhibit_mode){
                    this.flash_message("Sorry, cannot install, exhibit mode is active");
					
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
								this.flash_message('Addon was installed, but is not enabled yet')
                            }
                        }
                        else{
                            //console.log("installation failed, severely");
							this.flash_message('Error: could not install. Check the javascript console for details.')
                        }
                        
                        document.getElementById("extension-candleappstore-developer-busy-installing-app").style.display = 'none';
                        
            
        			})
					.catch((err) => {
        				console.log("candle store: caught error in manual installation: ", err);
						this.flash_message('Error: could not install. Could not connect to the controller.');
                        document.getElementById("extension-candleappstore-developer-busy-installing-app").style.display = 'none';
        			});
                }
                else{
                    this.flash_message("missing parameters");
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
                    if(this.debug){
                        console.log("candle store: LOGIN TEST RESPONSE: ", response);
                    }
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
                    this.flash_message("Sorry, reviews cannot be added in exhibit mode");
                    return;
                }
                
                review_save_button.style.display = 'none';
                
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
                   	 	this.flash_message("Please provide an opinion");
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
                        
                        review_save_button.style.display = 'inline-block';
                        
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
    					console.log("candle store: connection error while saving rating: ", e);
                        review_save_button.style.display = 'inline-block';
                        this.flash_message("A connection error occured, please try again.");
    				});
                }
                else{
                    this.flash_message("please select a rating first");
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
                //console.log('search input changed');
                this.generate_overview('shop');
			});
            
            document.getElementById('extension-candleappstore-filter-search-input').addEventListener('blur', (event) => {
                //console.log('search input blurred');
                this.generate_overview('shop');
			});
            
            
            //console.log("Candle store: Adding shop filter listeners");
            
            document.getElementById('extension-candleappstore-filter-privacy-select').addEventListener('change', (event) => {
                if(this.debug){
                    console.log('privacy filter changed to: ', document.getElementById('extension-candleappstore-filter-privacy-select').value);
                }
                try{
                    localStorage.setItem("candle_store_filter_privacy", document.getElementById('extension-candleappstore-filter-privacy-select').value);
                }catch(e){console.error("candle store: saving filter preference to local storage failed: ", e);}
                this.generate_overview('shop');
			});
            
            document.getElementById('extension-candleappstore-filter-reviews-select').addEventListener('change', (event) => {
                if(this.debug){
                    console.log('reviews filter changed');
                }
                try{
                    localStorage.setItem("candle_store_filter_reviews", document.getElementById('extension-candleappstore-filter-reviews-select').value);
                }catch(e){console.error("candle store: saving filter preference to local storage failed: ", e);}
                this.generate_overview('shop');
			});
            
            document.getElementById('extension-candleappstore-filter-expert-select').addEventListener('change', (event) => {
                if(this.debug){
                    console.log('expert filter changed');
                }
                try{
                    localStorage.setItem("candle_store_filter_expert", document.getElementById('extension-candleappstore-filter-expert-select').value);
                }catch(e){console.error("candle store: saving filter preference to local storage failed: ", e);}
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
            
            

            
            
            //console.log("candle store: calling init");
            
            //
            // INIT
            //
			window.API.postJson(
				`/extensions/candleappstore/api/ajax`,
				{'action':'init'}
			)
            .then((body) => {
				//console.warn("candle store: got show init response: ", body);
                this.parse_body(body);
                
                return window.API.getInstalledAddons()
				/*
                .then((result) => { 
    				//console.log("get_installed_addons_data: result: ");
    				//console.log(result);
                    this.api_addons_data = result;
                    myResolve();
                    return result;
    			}).catch((err) => {
					if(this.debug){
						console.error("window.API.getInstalledAddons caught error:", err);
					}
                    myReject();
    			});
				*/
                //return this.get_installed_addons_data()
                
                
                //document.getElementById('menu-button').classList.remove('hidden');

			})
            .then((result) => { 
                if(this.debug){
					console.log("candle store debug: response from get_installed_addons_data: ", result);
				}
				if(result){
					this.api_addons_data = result;
				}
                this.generate_overview('installed');
				if(this.jump_to_addon != ''){
					if(this.installed.indexOf(this.jump_to_addon) != -1){
						if(this.debug){
							console.warn("candle store debug: that addon is already installed: ", this.jump_to_addon);
						}
						this.show_selected_app(this.jump_to_addon);
					}
					else{
						if(this.debug){
							console.log("candle store debug: downloading get_apps.json before jumping to addon: ", this.jump_to_addon);
						}
						const json_file_for_this_candle_version = "get_apps_v" + this.mayor_candle_version + ".json";
	                    this.get_data( json_file_for_this_candle_version).then(response => {
							if(this.debug){
								console.log("candle store debug: downloading get_apps.json before jumping to addon: cloud app data received: ", response);
							}
	                        this.cloud_app_data = response;
	                        this.received_cloud_data = true;
							this.show_selected_app(this.jump_to_addon);
	                    })
	                    .catch((err) => {
							if(this.debug){
								console.error("candle store debug: caught error getting data for jump_to_addon from url: ", err);
							}
	        			});
					}
					this.jump_to_addon = '';
				}
				else if(this.jump_to_addon_settings != ''){
					if(this.debug){
						console.warn("candle store debug: should jump to settings of addon: ", this.jump_to_addon_settings);
					}
					if(this.installed.indexOf(this.jump_to_addon_settings) != -1){
						this.show_addon_config(this.jump_to_addon_settings);
						this.jump_to_addon_settings = '';
						
					}
					else{
						if(this.debug){
							console.error("candle store debug: addon to jump to settings page for is not installed: ", this.jump_to_addon_settings);
						}
						this.jump_to_addon_settings = '';
					}
					
				}
				
			})
            .catch((err) => {
				if(this.debug){
					console.error("candle store debug: caught error in init: ", err);
				}
			});
            
            
            
            document.getElementById('extension-candleappstore-broken-addons-reboot-button').addEventListener('click', (event) => {
                document.getElementById('extension-candleappstore-broken-addons-tip').style.display = 'none';
                window.API.postJson('/settings/system/actions', {
                    action: 'restartSystem'
                }).catch(console.error);
            });
            
            


			// TABS
			document.getElementById('extension-candleappstore-tab-button-installed').addEventListener('click', (event) => {
				//document.getElementById('extension-candleappstore-content').classList = ['extension-candleappstore-show-tab-satellites'];
                
                this.get_installed_addons_data()
                .then((result) => { 
                    //console.log("in get_installed_addons_data.then");
                    this.generate_overview('installed');
    			}).catch((err) => {
    				if(this.debug){
						console.error("candle store debug: get_installed_addons_data caught error:", err);
					}
    			});
                
			});

			document.getElementById('extension-candleappstore-tab-button-shop').addEventListener('click', (event) => {
				//document.getElementById('extension-candleappstore-content').classList = ['extension-candleappstore-show-tab-timers'];
                
                if(this.received_cloud_data){
                    if(this.debug){
                        console.log("candle store debug: already received data from the cloud earlier, so will use old data");
                    }
                    this.generate_overview('shop');
                }
                else{
                    
                    //console.log("asking for data from the cloud");
                    // Get data for apps overview
                    this.get_data("get_apps.json").then(response => {
                        if(this.debug){
                            console.log("candle store debug: GET ALL APPS from CLOUD response: ", response);
                        }
                        //console.log(response);
                
                        //const parsed = JSON.parse(response);
                        //console.log(parsed);
                        //this.cloud_app_data = parsed;
                        this.cloud_app_data = response;
                        this.received_cloud_data = true;
                        
                        // If this UI isn't naturally reloaded at some point, make sure there is an end date to how long cached data is used. Currently one hour.
                        try{
                            clearTimeout(window.cloud_app_cache_timeout);
                        }catch(e){
                            if(this.debug){
                                console.warn("candle store debug: window.cloud_app_cache_timeout failed to clear. Probably did not exist yet: ", e);
                            }
                        }
                        window.cloud_app_cache_timeout = setTimeout(() => {
                            this.received_cloud_data = false;
                        }, 3600000);
                        
                        
                        this.generate_overview('shop'); 
                        this.check_for_updates();
                    })
                    .catch((e) => {
        				//console.log("candle store: could not get data for apps overview");
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
						if(this.debug){
							console.log("candle store debug: error getting data for apps overview: ", e);
						}
        				//pre.innerText = "Could not get latest apps data! " + e.toString();
        			});
                }
				//document.getElementById('extension-candleappstore-content').classList = ['extension-candleappstore-show-tab-tutorial'];
			});
            
			
			
			//
			//  DEVELOPER TAB
			//
			
			this.view.querySelector('#extension-candleappstore-tab-button-developer').addEventListener('click', (event) => {
				this.show_developer_tab(this.developer_subtab);
			});
			
			this.view.querySelector('#extension-candleappstore-tab-developer-subtab-buttons').addEventListener('click', (event) => {
				const target_subtab = event.target.getAttribute('data-tab');
				if(typeof target_subtab == 'string'){
					this.show_developer_tab(target_subtab);
				}
			});
			
			this.view.querySelector('#extension-candleappstore-developer-things-filter-input-button').addEventListener('click', (event) => {
				this.show_things_attributes();
			});
			
			
			
			if(this.keyboard_listener_added == false){
				this.keyboard_listener_added = true;
				//console.log("candle store: adding keyboard listener");
				document.addEventListener('keydown', (event) => {
					//console.log(`candle store: Key pressed: ${event.key}`);
					//console.log(`candle store: Key code: ${event.keyCode}`);
					//console.log("this.current_page: ", this.current_page);
					if(this.current_page == "installed"){
					    
						const item_to_scroll_to = this.view.querySelector('#extension-candleappstore-installedlist .extension-candleappstore-item[data-addon-id^="' + event.key + '"]');
						if(item_to_scroll_to){
							item_to_scroll_to.scrollIntoView({block: 'center',inline: 'center'});
						}
						//console.log("item_to_scroll_to: ", item_to_scroll_to);
					}
				})
			}


		} // end of show()
		
	
    
    
    
    
    
    
        
        // Ask python to request some app server data
        get_data = (url, parameters) => {
			
			if(this.debug){
				console.log("candle store debug: asking server to get some data.  url, parameters: ", url, parameters);
			}
			
            const pre = document.getElementById('extension-candleappstore-response-data');
            //console.log(this);
            
            if(typeof parameters == 'undefined'){
                parameters = {};
            }
            
			
			// TODO: this seems a bit convoluted now
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

    	        }).catch((err) => {
					if(this.debug){
						console.error("candle store debug: caught error in get getJson:", err);
					}
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
            return new Promise((myResolve, myReject) =>
            {
                window.API.getInstalledAddons()
                .then((result) => { 
    				//console.log("get_installed_addons_data: result: ");
    				//console.log(result);
                    this.api_addons_data = result;
                    myResolve();
                    return result;
    			}).catch((err) => {
					if(this.debug){
						console.error("candle store debug: window.API.getInstalledAddons caught error:", err);
					}
                    myReject();
    			});
            });
        };
        
        
        // No longer used
        /*
        remember_permission = (addon_id, permission, value) =>
        {
            //const pre = document.getElementById('extension-candleappstore-response-data');
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
                    myReject({});
    	        });	
            });
        }
        */
        
       
        
		get_init(){
			window.API.postJson(
				`/extensions/candleappstore/api/ajax`,
				{'action':'init'}
			)
            .then((body) => {
				if(this.debug){
					console.log("candle store debug: get_init response: ", body);
				}
                this.parse_body(body);
			})
			.catch((err) => {
				if(this.debug){
					console.error("candle store debug: caught error in get_init: ", err);
				}
			})
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
                
                let random_addon_id_index = Math.floor(Math.random() * this.addons_to_update.length);
				
				if(this.addons_to_update.indexOf('candleappstore') != -1){
					if(this.debug){
						console.log("candle store debug: upload loop: updating the appstore itself first");
					}
					random_addon_id_index = this.addons_to_update.indexOf('candleappstore');
				}
				else if(this.addons_to_update.indexOf('power-settings') != -1){
					if(this.debug){
						console.log("candle store debug: upload loop: prioritizing the power-settings addon");
					}
					random_addon_id_index = this.addons_to_update.indexOf('power-settings');
				}
				
                //console.log('random_addon_id_index: ', random_addon_id_index);
                const cloud_addon_data = this.get_cloud_addon_data(this.addons_to_update[random_addon_id_index]);
                if(cloud_addon_data != null){
                    window.API.updateAddon( cloud_addon_data.addon_id, cloud_addon_data.download_url, cloud_addon_data.checksum )
                    .then((result) => {
						if(this.debug){
							console.log('candle store debug: update_all: addon updated succesfully: ', cloud_addon_data.addon_id);
						}
                        this.addons_to_update = this.addons_to_update.filter(e => e !== cloud_addon_data.addon_id);
                		
						if(cloud_addon_data.addon_id == 'candleappstore'){
                            setTimeout(function(){
                                window.location.reload(true);
                            }, 500);
						}
                        else if(this.addons_to_update.length == 0 ){
                            document.getElementById('extension-candleappstore-tab-button-updates').classList.remove('extension-candleappstore-tab-button-updates-available');
                            document.getElementById('extension-candleappstore-updates-list').innerHTML = "All your addons are up to date";
                            document.getElementById('extension-candleappstore-update-all-button').style.display = 'none';
                            document.body.classList.remove("extension-candleappstore-busy-updating-all");
                            this.updating_all = false;
                            
                            setTimeout(function(){
                                window.location.reload(true); // harsh, but no UI's without backends this way.
                            }, 2500);
                        }
                        else{
                            //console.log('on to the next addon.');
                            this.generate_overview('updates');
                            setTimeout(() => {
                            	this.update_loop();
                            },5000);
                        }
                
        			}).catch((err) => {
        				if(this.debug){
							console.error("candle store debug: update addons loop caught error: ", err);
						}
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

                if(this.debug){
                    console.log("\n.\n.\n.\ncandle store debug: in generate_overview. page: ", page);
                }
                
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
                
                
                if(this.debug){
                    console.log("candle store: generate_overview: using data: ", data);
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
				
				let appended_item_counter = 0;
				
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
						
						const my_data = data[i];
						
                        let addon_id = "error";

                        // Get the data about this addon from the gateway API as well
                        var api_data = null;
                        try{
                            
                            if(page == 'shop'){
                                addon_id = data[i].addon_id;
                                api_data = data[i];
                            }
                            else{
                                api_data = data[i];     // do not change this order
                                addon_id = api_data.id; // sic
                                
                            }
                        }
                        catch(err){
                            console.error("candle store: error getting api data for addon: ", err);
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
                                
                                var t = document.createElement('div');
								if(info == 'name'){
									t.classList.add('extension-candleappstore-installed-addon-name-line');
								}
								else{
									t.classList.add('extension-candleappstore-installed-addon-description-line');
								}
								
                                var text = linkify(data[i][info], true); // removes links from descriptions, and turns them into actual links
                                
                                if(page == 'installed' && info == 'name'){
                                    text += '<span class="extension-candleappstore-basic-version">' + data[i]['version'] + '</span>';
                                    text = '<img src="/extensions/' + addon_id + '/images/menu-icon.svg" alt="' + data[i][info] + ' icon" class="extension-candleappstore-installed-addon-icon" width="24" height="24"  onload="(function(){this.style.display=\'inline-block\'}).call(this)" onerror="(function(){this.style.display=\'none\'}).call(this)"> ' + text;
									
                                    try{
                                        if(typeof this.addon_sizes[addon_id] != 'undefined'){
                                            let rounded_size = Math.round(0.5 + (this.addon_sizes[addon_id] / 1000) );
                                            text += '<span class="extension-candleappstore-addon-size">' + rounded_size + '</span>';
                                        }
                                    }
                                    catch(err){
										if(this.debug){
                                        	console.log("candle store debug: caught error adding addon size: ", err);
										}
                                    }
                                    
                                }
                                
                                
                                
                                t.innerHTML = text;
                                
                                const selector_name = '.extension-candleappstore-basic-' + info;
                                var target_element = clone.querySelector( selector_name );
								if(target_element){
									target_element.appendChild(t);
								}
                                
                            }
                            
                
                        });
                
                
                        // open the app details page
    					clone.addEventListener('click', (event) => {
                            event.stopImmediatePropagation();
    						const target = event.currentTarget;
                            const data_addon_id = target.getAttribute('data-addon-id');
                            
                            this.show_selected_app(data_addon_id,my_data);

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
                                    
										if(appended_item_counter == 0){
											clone.classList.add('item_nr' + appended_item_counter);
											//console.warn("\n\n\ncandle store: FIRST ITEM: ", data[i]);
											
											try{
												if(typeof data[i]['packages'] != 'undefined' && 
													typeof data[i]['packages'][0] != 'undefined' && 
													typeof data[i]['packages'][0]['url'] == 'string' && 
													data[i]['packages'][0]['url'].indexOf('/releases') != -1 &&
													(data[i]['packages'][0]['url'].startsWith('https://github.com/createcandle') || 
													data[i]['packages'][0]['url'].startsWith('https://github.com/flatsiedatsie'))
												){
													const base_url = data[i]['packages'][0]['url'].split('/releases')[0];
													const potential_screenshot_urls = [
																{
																	'from': base_url + '/raw/main/screenshot.png?raw=true',
																	'to': addon_id + '_screenshot.png'
																},
																{
																	'from': base_url + '/raw/main/screenshot.jpg?raw=true',
																	'to': addon_id + '_screenshot.jpg'
																}
															]
													
													if(this.debug){
														console.warn("candle store debug: potential_screenshot_urls: ", potential_screenshot_urls);
													}
												
									    	        window.API.postJson(
									    	            `/extensions/${this.id}/api/ajax`,
									    			    {'action':'web_cache','urls':potential_screenshot_urls}

									    	        ).then((body) => {
									                    if(this.debug){
															console.warn("candle store debug: web_cache response: ", body);
														}
														setTimeout(() => {
															if(typeof body.web_cache != 'undefined' && body.web_cache.length){
																const screenshots_container_el = this.view.querySelector('.item_nr0 .extension-candleappstore-basic-screenshots');
																if(screenshots_container_el){
																	screenshots_container_el.innerHTML = '';
												                    if(this.debug){
																		console.warn("candle store debug: adding locally cached screenshots: ", body.web_cache);
																	}
																	for(let sc = 0; sc < body.web_cache.length; sc++){
																		if(typeof body.web_cache[sc]['to'] == 'string'){
																			let screenshot_el = document.createElement('img');
																			screenshot_el.classList.add('extension-candleappstore-basic-screenshot');
																			screenshot_el.setAttribute('alt','Screenshot');
																			screenshot_el.setAttribute('src','/extensions/candleappstore/web_cache/' + body.web_cache[sc]['to']);
																			screenshots_container_el.appendChild(screenshot_el);
																		}
																	}
																}
															}
														},1000);
														

									    	        }).catch((err) => {
									                    if(this.debug){
									                        console.error("candle store: caught error calling web_cache: ", err);
									                    }
									    	        });	
												
												}
											}
											catch(err){
												console.error("caught error attempting web_cache for screenshots: ", err);
											}
											
											
											
											if(this.received_cloud_data){
												console.log("this.cloud_app_data: ", this.cloud_app_data);
											}
					                        
											
										}
									
                                        output_list_element.appendChild(clone); 
										appended_item_counter++;
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
                        
                        
                        
                        
                        
                        // not the stop page
                        else{
                            // This parts only deals with addons that are installed.
                            if(current_highlight_level == 0){ // this makes it so that it only runs through this on the first iteration. Items in the shop are done in 5 levels instead.
                                //already installed, so add SETTINGS BUTTON (and then PLAY/PAUSE button)
                                
                    			const clone_basic_options_el = clone.querySelector('.extension-candleappstore-basic-options');
								
								// CHECK FOR PRE_RELEASE BUTTON
								if(this.developer && page=='installed' && typeof my_data['version'] == 'string'){
									
									//console.log("creating BETA button with my_data: ", my_data);
									
									if(typeof my_data['homepage_url'] == 'string' && my_data['homepage_url'] != ''){
										//if( my_data['homepage_url'].indexOf('candle') != -1 || my_data['homepage_url'].indexOf('/flatsiedatsie/') != -1){
										
										const clone_developer_options_el = clone.querySelector('.extension-candleappstore-developer-options-container');
										
										if(clone_developer_options_el){
											const release_addon_id = addon_id
										
											
											// RESTART ADDON BUTTON
											
			                                const restart_addon_button_el = document.createElement("button");
			                                restart_addon_button_el.classList.add('extension-candleappstore-restart-addon-button');
			                                restart_addon_button_el.classList.add('extension-candleappstore-button');
											restart_addon_button_el.classList.add('extension-candleappstore-show-if-developer');
			                                restart_addon_button_el.setAttribute('data-extension', ui_extension);
			                                restart_addon_button_el.setAttribute('data-addon_id', release_addon_id);
											restart_addon_button_el.setAttribute('data-current_version', my_data['version']);
											restart_addon_button_el.textContent = 'Restart';
											
											if(typeof this.pre_release_addons[release_addon_id] == 'string'){
												restart_addon_button_el.textContent = this.pre_release_addons[release_addon_id];
											}
											
			            					restart_addon_button_el.addEventListener('click', (event) => {
			                                    event.stopImmediatePropagation();
												restart_addon_button_el.classList.add('extension-candleappstore-fade');
												restart_addon_button_el.classList.add('extension-candleappstore-extra-fade');
												restart_addon_button_el.classList.add('extension-candleappstore-busy-updating');
		                                        
												window.API.setAddonSetting( release_addon_id, false)
		                                        .then((result) => {
													restart_addon_button_el.classList.remove('extension-candleappstore-extra-fade');
		                                        	setTimeout(() => {
		                                        		window.API.setAddonSetting( release_addon_id, true)
														.then((result) => {
															if(this.debug){
					                                        	console.log("candle store debug: addon should now be restarted: ", release_addon_id);
															}
															restart_addon_button_el.classList.remove('extension-candleappstore-fade');
															restart_addon_button_el.classList.remove('extension-candleappstore-extra-fade');
															restart_addon_button_el.classList.remove('extension-candleappstore-busy-updating');
														})
														.catch((err) => {
															if(this.debug){
																console.error("candle store debug: caught error really restarting addon: ", release_addon_id, err);
															}
															restart_addon_button_el.classList.remove('extension-candleappstore-fade');
															restart_addon_button_el.classList.remove('extension-candleappstore-extra-fade');
															restart_addon_button_el.classList.remove('extension-candleappstore-busy-updating');
														})
		                                        	},2000);
		                                        })
												.catch((err) => {
													if(this.debug){
														console.error("candle store debug: caught error restarting addon: ", release_addon_id, err);
													}
													restart_addon_button_el.classList.remove('extension-candleappstore-fade');
													restart_addon_button_el.classList.remove('extension-candleappstore-extra-fade');
													restart_addon_button_el.classList.remove('extension-candleappstore-busy-updating');
												})
											})
											
											clone_basic_options_el.appendChild(restart_addon_button_el);
											
	                                        
											
											
											
										
											// INSTALL NORMAL LATEST VERSION BUTTON
											
			                                const normal_release_check_button_el = document.createElement("button");
			                                normal_release_check_button_el.classList.add('extension-candleappstore-selected-normal-release-check-button');
			                                normal_release_check_button_el.classList.add('extension-candleappstore-button');
											//normal_release_check_button_el.classList.add('extension-candleappstore-show-if-developer');
			                                normal_release_check_button_el.setAttribute('data-extension', ui_extension);
			                                normal_release_check_button_el.setAttribute('data-addon_id', release_addon_id);
											normal_release_check_button_el.setAttribute('data-current_version', my_data['version']);
											normal_release_check_button_el.textContent = 'LATEST';
											
											
			            					normal_release_check_button_el.addEventListener('click', (event) => {
			                                    event.stopImmediatePropagation();
                                				
												if(confirm("Are you sure you want to update " + release_addon_id + '?')){
													//normal_release_check_button_el.remove();
													
				                                    if(this.exhibit_mode){
				                                        console.warn("Candle store: cannot check for pre-releases while in exhibit mode");
				                                        return;
				                                    }
													
													normal_release_check_button_el.classList.add('extension-candleappstore-busy-updating');
													normal_release_check_button_el.classList.add('extension-candleappstore-pointer-events-none');
													
													window.API.setAddonSetting( release_addon_id, false)
			                                        .then((result) => {
														
														if(this.debug){
															console.log("candle store debug: calling install_normal_release with:  \naddon_id,current_version,homepage_url: \n", release_addon_id, my_data['version'], my_data['homepage_url']);
														}
														
										    	        return window.API.postJson(
										    	            `/extensions/${this.id}/api/ajax`,
										    			    {'action':'install_release','addon_id':release_addon_id,'current_version':my_data['version'],'homepage_url':my_data['homepage_url'],'release_type':'normal'}
										    	        )
													
													})
									    	        .then((body) => {
									                    if(this.debug){
															console.log("candle store debug: install_normal_release response: ", body);
														}
												
														if(typeof body['message'] == 'string' && body['message'] != ''){
															if(this.debug){
																console.warn("install_normal_release response message: ", body['message']);
															}
															if(typeof body['message'] == 'string' && body['message'].length){
																this.flash_message(body['message']);
															}
														}
												
														if(typeof body['pre_release_addons'] != 'undefined'){
															this.pre_release_addons = body['pre_release_addons'];
														}
												
									    				if(body['state'] == true){
                    										
															if(typeof body['new_version'] == 'string'){
																normal_release_check_button_el.textContent = body['new_version'];
																
																// Try to find the old version tag and, if needed, indicate that it's no longer valid
																const parent_item_el = normal_release_check_button_el.closest('.extension-candleappstore-item');
																if(parent_item_el){
																	const basic_version_el = parent_item_el.querySelector('.extension-candleappstore-basic-version');
																	if(basic_version_el){
																		if(basic_version_el.textContent != body['new_version']){
																			basic_version_el.classList.add('extension-candleappstore-strike-through');
																			basic_version_el.classList.add('extension-candleappstore-extra-fade');
																		}
																	}
																}
															}
															
															
									                        // Update all the values in a central method
									                        //this.parse_body(body);
													
				                                            return window.API.setAddonSetting( release_addon_id, true);
															
				                                            //.catch((err) => {
				                                			//	console.error("install_normal_release: get_installed_addons_data caught error:", err);
				                                			//});
											
														}
														else{
															return null;
														}

									    	        })
													.then((result) => {
														return this.get_installed_addons_data()
													})
		                                            .then((result) => { 
		                                                if(this.debug){
															console.log("candle store debug: regenerating installed overview after attempting to install a pre-release");
														}
		                                                this.generate_overview('installed');
		                                                //return;
		                                			})
													.catch((err) => {
									                    if(this.debug){
									                        console.error("candle store deebug: error calling addon api for install_normal_release: ", err);
									                    }
														normal_release_check_button_el.classList.remove('extension-candleappstore-busy-updating');
														normal_release_check_button_el.classList.remove('extension-candleappstore-pointer-events-none');
									    	        });	
                                				}
												
											})
								
			                                //let clone_basic_options_el = clone.querySelector('.extension-candleappstore-basic-options');
											clone_developer_options_el.appendChild(normal_release_check_button_el);
											
										
										
										
										
										
											// INSTALL PRE-RELEASE (BETA) BUTTON
										
			                                const pre_release_check_button_el = document.createElement("button");
			                                pre_release_check_button_el.classList.add('extension-candleappstore-selected-pre-release-check-button');
			                                pre_release_check_button_el.classList.add('extension-candleappstore-button');
											pre_release_check_button_el.classList.add('extension-candleappstore-show-if-developer');
			                                pre_release_check_button_el.setAttribute('data-extension', ui_extension);
			                                pre_release_check_button_el.setAttribute('data-addon_id', release_addon_id);
											pre_release_check_button_el.setAttribute('data-current_version', my_data['version']);
											pre_release_check_button_el.textContent = 'BETA';
											if(typeof this.pre_release_addons[release_addon_id] == 'string'){
												pre_release_check_button_el.textContent = this.pre_release_addons[release_addon_id];
											}
											
			            					pre_release_check_button_el.addEventListener('click', (event) => {
			                                    event.stopImmediatePropagation();
                                				
												if(confirm("Are you sure you want to try a beta version of " + release_addon_id + '?')){
													//pre_release_check_button_el.remove();
													pre_release_check_button_el.classList.add('extension-candleappstore-busy-updating');
													pre_release_check_button_el.classList.add('extension-candleappstore-pointer-events-none');
									
				                                    if(this.exhibit_mode){
				                                        console.warn("Candle store: cannot check for pre-releases while in exhibit mode");
				                                        return;
				                                    }
											
													if(this.debug){
														console.log("candle store debug: calling install_pre_release with:  \naddon_id,current_version,homepage_url: \n", release_addon_id, my_data['version'], my_data['homepage_url']);
													}
													
													
													
									    	        window.API.postJson(
									    	            `/extensions/${this.id}/api/ajax`,
									    			    {'action':'install_release','addon_id':release_addon_id,'current_version':my_data['version'],'homepage_url':my_data['homepage_url'],'release_type':'pre'}

									    	        ).then((body) => {
									                    if(this.debug){
															console.log("candle store debug: install_pre_release response: ", body);
														}
												
														if(typeof body['message'] == 'string' && body['message'] != ''){
															if(this.debug){
																console.warn("install_pre_release response message: ", body['message']);
															}
															if(typeof body['message'] == 'string' && body['message'].length){
																this.flash_message(body['message']);
															}
														}
												
														if(typeof body['pre_release_addons'] != 'undefined'){
															this.pre_release_addons = body['pre_release_addons'];
														}
												
									    				if(body['state'] == true){
                    								
															if(typeof body['new_version'] == 'string'){
																pre_release_check_button_el.textContent = body['new_version'];
																
																// Try to find the old version tag and, if needed, indicate that it's no longer valid
																const parent_item_el = pre_release_check_button_el.closest('.extension-candleappstore-item');
																if(parent_item_el){
																	const basic_version_el = parent_item_el.querySelector('.extension-candleappstore-basic-version');
																	if(basic_version_el){
																		if(basic_version_el.textContent != body['new_version']){
																			basic_version_el.classList.add('extension-candleappstore-strike-through');
																			basic_version_el.classList.add('extension-candleappstore-extra-fade');
																		}
																	}
																}
															}
															
													
									                        // Update all the values in a central method
									                        //this.parse_body(body);
													
				                                            this.get_installed_addons_data()
				                                            .then((result) => { 
				                                                if(this.debug){
																	console.log("candle store debug: regenerating installed overview after attempting to install a pre-release");
																}
				                                                this.generate_overview('installed');
				                                                //return;
				                                			}).catch((err) => {
				                                				console.error("install_pre_release: get_installed_addons_data caught error:", err);
																pre_release_check_button_el.classList.remove('extension-candleappstore-busy-updating');
																pre_release_check_button_el.classList.remove('extension-candleappstore-pointer-events-none');
				                                			});
											
									    				}

									    	        }).catch((err) => {
									                    if(this.debug){
									                        console.error("candle store: error calling addon api for install_pre_release: ", err);
									                    }
														pre_release_check_button_el.classList.remove('extension-candleappstore-busy-updating');
														pre_release_check_button_el.classList.remove('extension-candleappstore-pointer-events-none');
									    	        });	
												}
									
											})
								
			                                //let clone_basic_options_el = clone.querySelector('.extension-candleappstore-basic-options');
											clone_developer_options_el.appendChild(pre_release_check_button_el);
											
											
											
											
											
											
											
										}
										
										
										
										
			                                
									}
								}
								
								
								
                    
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
                                    if(this.debug){
                                        console.log("candle store debug: ERROR, this installed addon had no api_data!?: ", addon_id);
                                    }
                                    t = document.createTextNode("error");
                                    b.appendChild(t);
                                }
                    
            					b.addEventListener('click', (event) => {
                                    //console.log("playpause button clicked");
                                    //console.log(event);
                                    event.stopImmediatePropagation();
                                    //if (event.target.tagName.toLowerCase() === 'label') {
                                    //console.log( addon_id );
                                    
                                    if(this.exhibit_mode){
                                        console.warn("Candle store: cannot start/stop addons while in exhibit mode");
                                        return;
                                    }
                                    
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
                                                }, 3500);
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
										this.flash_message('There is something wrong with this app. You could try re-installing it.');
                                    }
                        
                                });
                                
                                //console.log("adding play/pause button");
                                //document.getElementById("extension-candleappstore-selected-options").appendChild(b);
                    
                                //clone.setAttribute('data-enabled', 1);
                                
                                if(page != 'updates' && addon_id != 'candleappstore'){
                                    clone_basic_options_el.appendChild(b);
                                }
                                
                                
                                
                                
                                
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
                                    
                                    if(this.exhibit_mode){
                                        console.warn("Candle store: cannot change addon settings while in exhibit mode");
                                        return;
                                    }
                                    
                                    this.show_addon_config( event.target.getAttribute('data-addon-id') );                
                        
                        
                                });
                                //console.log("adding settings button");
                                //document.getElementById("extension-candleappstore-selected-options").appendChild(b);
                    
                                clone.setAttribute('data-installed', 1);
                                //var target_element = clone.querySelector( '.extension-candleappstore-basic-options' );
                                if(page != 'updates'){
                                    clone_basic_options_el.appendChild(b);
                                }
                                
                                //installed_list.appendChild(clone);
                                
                                
                                
                                
                                
                                
                                
                                
                                
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
                                            
                						}).catch((err) => {
											if(this.debug){
												console.error("candle store debug: update addon catch (error?): ", err);
											}
                							
                                            //console.log(e);
                                            event.target.parentNode.parentNode.parentNode.classList.remove("extension-candleappstore-busy-updating");
                                            document.getElementById('extension-candleappstore-update-all-button').style.display = 'block';
											this.flash_message('Could not update. Connection error?');
                                            
                						});
                                        
                                    }
                        
                                });
                                //console.log("adding settings button");
                                //document.getElementById("extension-candleappstore-selected-options").appendChild(b);
                    
                                clone.setAttribute('data-installed', 1);
                                //var target_element = clone.querySelector( '.extension-candleappstore-basic-options' );
                                if(page == 'updates'){
                                    if(this.addons_to_update.indexOf(addon_id) != -1){
                                        clone_basic_options_el.appendChild(b);
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
						
						const privacy_filter_select_el = document.getElementById('extension-candleappstore-filter-privacy-select');
						const review_filter_select_el = document.getElementById('extension-candleappstore-filter-reviews-select');
						const expert_filter_select_el = document.getElementById('extension-candleappstore-filter-expert-select');
						
						if( (expert_filter_select_el.value != '4' && expert_filter_select_el.value != '5') || privacy_filter_select_el.value != '0' || review_filter_select_el.value != '0'){
							var show_all_addons_button_el = document.createElement("div");
							show_all_addons_button_el.setAttribute('id', 'extension-candleappstore-show-all-addons-button');
							show_all_addons_button_el.textContent = 'Show all';
							show_all_addons_button_el.addEventListener('click', () => {
								//document.getElementById('extension-candleappstore-filter-search-input').value = '';
								privacy_filter_select_el.value = 0;
								review_filter_select_el.value = 0;
								expert_filter_select_el.value = 4;
								this.generate_overview('shop');
							});
							document.getElementById('extension-candleappstore-list').appendChild(show_all_addons_button_el);
						}
						
                    }
                }
                
                // Check if all addon directories are output in the list
                
                if(page == 'installed'){
                    this.not_shown_addons_list = [];
                    //console.log("shown_as_installed_list: ", shown_as_installed_list);
                    //console.log("installed dirs: ", this.installed);
                    for(var p = 0; p < this.installed.length; p++){
                        
                        if(shown_as_installed_list.indexOf( this.installed[p] ) == -1){
                            if(this.debug){
                                console.log("Candle App store: debug: warning, spotted an addon that was not shown in the installed list, but should have been: ", this.installed[p]);
                            }
                            this.not_shown_addons_list.push( this.installed[p] );
                        }
                    }
                    // Show list of broken addons
                    if(this.not_shown_addons_list.length > 0){
                        if(this.debug){
                            console.log("candle store debug: this.not_shown_addons_list: ", this.not_shown_addons_list);
                        }
                    
                        document.getElementById('extension-candleappstore-broken-addons-list').innerHTML = "";
                    
                        for(var b = 0; b < this.not_shown_addons_list.length; b++){
                            var broken_item_el = document.createElement('div');
                            broken_item_el.appendChild(document.createTextNode("Delete " + this.not_shown_addons_list[b]));
                            broken_item_el.classList.add('extension-candleappstore-broken-addon-item');
                            broken_item_el.dataset.addon_id = this.not_shown_addons_list[b];
                            document.getElementById('extension-candleappstore-broken-addons-list').appendChild(broken_item_el);
                        }
                        document.getElementById('extension-candleappstore-broken-addons-container').style.display = 'block';
                    
                    }
                    else{
                        if(this.debug){
                            console.log("candle store debug: this.not_shown_addons_list.length: ", this.not_shown_addons_list.length);
                        }
                        document.getElementById('extension-candleappstore-broken-addons-container').style.display = "none";
                    }
                }
                
                
				if(this.debug){
					console.log("candle store debug: this.addons_with_newer_versions_on_latest_candle: ", this.addons_with_newer_versions_on_latest_candle );
				}
				if(page == 'updates' && Object.keys( this.addons_with_newer_versions_on_latest_candle ).length){
					const out_of_reach_list_el = this.view.querySelector('#extension-candleappstore-out-of-reach-addons-list');
					if(out_of_reach_list_el){
						this.view.querySelector('#extension-candleappstore-out-of-reach-addons-container').classList.remove('extension-candleappstore-hidden');
						out_of_reach_list_el.innerHTML = '';
						for (const [addon_name, addon_version] of Object.entries( this.addons_with_newer_versions_on_latest_candle )) {
							let out_of_reach_item_el = document.createElement('div');
							out_of_reach_item_el.textContent = addon_name;
							out_of_reach_list_el.appendChild(out_of_reach_item_el);
						}
					}
				}
                
            }
			catch (err) {
				if(this.debug){
					console.error("candle store debug: caught error in generate overview: ", err);
				}
			}
			
			
			this.get_init();
        }

        
        
        
        //update_addon_defaults_after_install()
        
        // Update after install (turned into separate function to avoid nested api calls)
        
        update_after_install(addon_data){
            if(this.debug){
                console.log("candle store: in update_after_install. addon_data: ", addon_data);
            }
            window.API.getInstalledAddons()
            .then((result) => { 
				if(this.debug){
                    console.log("candle store: update_after_install: get_installed_addons_data: result: ");
                }
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
                        if(this.debug){
                            console.log("candle store: this addon has a UI, so switching to that.");
                        }
                        window.location.pathname = '/extensions/' + addon_data["addon_id"];
                    }
                }
                
                if(addon_data["addon_id"] != 'zigbee2mqtt-adapter'){
                    document.getElementById("extension-candleappstore-selected-post-install-addon-name").innerText = addon_data["addon_id"];
                    document.getElementById("extension-candleappstore-selected-post-install").style.display = 'block'; 
                }
                else{
                    window.location.pathname = '/extensions/zigbee2mqtt-adapter';
                }
                
                //document.getElementById("extension-candleappstore-post-install-settings-button").setAttribute("data-addon_id", data['versions'][v]["addon_id"]);
                document.getElementById("extension-candleappstore-busy-installing").style.display = 'none';
            
			}).catch((e) => {
				console.error("candle store: get getInstalledAddons info catch (error?): ", e);
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
                    console.log("Appstore debug: Manual uninstall: removed addon? ", body);
                }
                if(typeof body.addon_dirs != 'undefined'){
                    this.installed = body.addon_dirs;
                }
                document.getElementById('extension-candleappstore-broken-addons-tip').style.display = 'block';
            
    		})
            .catch((e) => {
    			console.log("candle store: error calling manually delete addon: ", e);
    		});
        }
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        //
        //  SHOW SELECTED APP
        //
        
        show_selected_app(addon_id,data={}){
            if(this.debug){
                console.log('candle store: in show_selected_app. addon_id and data: ', addon_id, data);
            }
            
			if(typeof addon_id != 'string'){
				console.error("candle store: show_selected_app: addon_id was not a string: ", addon_id);
				return
			}
			
            // Attempt to find some data for the addon_id if data isn't already provided
            //if(data.provided != 'undefined'){
            if(Object.keys(data).length == 0){
                if(this.debug){
                    console.warn("show_selected_app was called, but addon data was not provided");
                }
                if(this.cloud_app_data.length > 0){
                    data = this.get_cloud_addon_data(addon_id);
                }
                
            }
            
            
            
            // clear the search term, if there was one
            document.getElementById('extension-candleappstore-filter-search-input').value = ''; 
            
            
            // CLEAN UP
            
            // Hides the data that might need to be loaded in from the Candle webserver (which can take a little time) in one swoop
            document.getElementById('extension-candleappstore-selected-secondary').style.display = 'none';
            document.getElementById('extension-candleappstore-selected-homepage_url').style.display = 'none';
            
            const selected = document.getElementById('extension-candleappstore-selected');
            
            //document.getElementById('extension-candleappstore-selected-main').style.display = 'none';
            document.getElementById("extension-candleappstore-busy-installing").style.display = 'none';
            document.getElementById("extension-candleappstore-busy-uninstalling").style.display = 'none';
            document.getElementById('extension-candleappstore-busy-loading-app').style.display = 'flex';
			
			const selected_icon_el = document.getElementById('extension-candleappstore-selected-icon');
			if(selected_icon_el){
				document.getElementById('extension-candleappstore-selected-icon').src = '/extensions/' + addon_id + '/images/menu-icon.svg';
			}
            // clear opinion, which doesn't always exist
            if(document.getElementById("extension-candleappstore-selected-opinion") != null){
                document.getElementById("extension-candleappstore-selected-opinion").innerHTML = "";
            }
            
            // clear tags, but create one invisible one to keep the hight the same
            document.getElementById('extension-candleappstore-selected-tags').innerHTML = '<span class="extension-candleappstore-tag extension-candleappstore-invisible">...</span>';
            
            // Addon name
            if(typeof data.name != 'undefined'){
                document.getElementById('extension-candleappstore-selected-name').innerText = data.name;
                
                // Version
                if(typeof data.mayor_version != 'undefined'){
                    document.getElementById('extension-candleappstore-selected-mayor_version').innerText = data.mayor_version;
                }
                else{
                    document.getElementById('extension-candleappstore-selected-mayor_version').innerText = "";
                }
                if(typeof data.meso_version != 'undefined'){
                    document.getElementById('extension-candleappstore-selected-meso_version').innerText = data.meso_version;
                }
                else{
                    document.getElementById('extension-candleappstore-selected-meso_version').innerText = "";
                }
                if(typeof data.minor_version != 'undefined'){
                    document.getElementById('extension-candleappstore-selected-minor_version').innerText = data.minor_version;
                }
                else{
                    document.getElementById('extension-candleappstore-selected-minor_version').innerText = "";
                }
                
                // Description
                if(typeof data.description != 'undefined'){
                    document.getElementById('extension-candleappstore-selected-description').innerHTML = data.description;
                }
                else{
                    document.getElementById('extension-candleappstore-selected-description').innerHTML = "...";
                }
                
                // Author
                if(typeof data.author != 'undefined'){
                    document.getElementById('extension-candleappstore-selected-author').innerHTML = data.author;
                }
                else{
                    document.getElementById('extension-candleappstore-selected-author').innerHTML = "...";
                }
                
                // Homepage
                 if(typeof data.homepage_url != 'undefined'){
                     document.getElementById('extension-candleappstore-selected-homepage_url').href = data.homepage_url;
                     if(this.kiosk == false){
                         document.getElementById('extension-candleappstore-selected-homepage_url').style.display = 'block';
                     }
                     
                 }
                 else{
                     document.getElementById('extension-candleappstore-selected-homepage_url').href = "#"; // will be loaded in fully later
                 }
                
            }
            else{
                if(this.debug){
					console.warn("candle store debug: strange, the addon data.name was undefined.  data: ", data);
				}
                document.getElementById('extension-candleappstore-selected-name').innerHTML = "Loading...";
                document.getElementById('extension-candleappstore-selected-author').innerHTML = "...";
                document.getElementById('extension-candleappstore-selected-description').innerHTML = "...";
                
            }
            
            
			// Show a hint if a newer version is available if the user upgrades to a newer version of Candle
			if(!this.candle_version.startsWith('3.') && !this.candle_version.startsWith('4.')){
				if(typeof this.addons_with_newer_versions_on_latest_candle[addon_id] != 'undefined'){
					this.view.querySelector('#extension-candleappstore-out-of-reach-hint').classList.remove('extension-candleappstore-hidden');
				}
				else{
					this.view.querySelector('#extension-candleappstore-out-of-reach-hint').classList.add('extension-candleappstore-hidden');
				}
			}
			
            
            // SHOW
            
            // Now the overlay can be shown
            selected.style.display = 'block';
            
            
            // We still need to load additional details, such as the latest review scores
            const url = "get_app.php?addon_id=" + addon_id;
            //console.log(url);
    
            this.get_data(url)
            .then(data => {
                if(this.debug){
    				console.log("appstore debug: show_selected_app: GET APP response: ", data);
                }
                
                //this.show_selected_app(data_addon_id, response, target.getAttribute('data-installed') ); // data, and whether it is installed already
                
                try{
                    
                    document.getElementById('extension-candleappstore-busy-loading-app').style.display = 'none';
                    //console.log("in show_selected_app");
                    //console.log(data);
                
                    //const pre = document.getElementById('extension-candleappstore-response-data');
                    //const selected = document.getElementById('extension-candleappstore-selected');
                    const selected_options_bar = document.getElementById("extension-candleappstore-selected-options");
                    
                    //selected.style.display = 'block';
               
                    document.getElementById('extension-candleappstore-screenshots').innerHTML = "";
                    
                    document.getElementById("extension-candleappstore-selected-main").style.display = 'block';
                    //document.getElementById('extension-candleappstore-selected-main').style.display = 'block';
                    document.getElementById("extension-candleappstore-selected-post-install").style.display = 'none';
                
                    document.getElementById("extension-candleappstore-review-response").innerText = "";

                    document.getElementById("extension-candleappstore-review-container").style.display = "none";
                    document.getElementById('extension-candleappstore-review-complete').style.display = "none";
                    
                    
                    
                
                    if(typeof data.error != 'undefined'){
                        //console.log("There was an arror showing the app. Maybe server gave a bad response?");
                        console.log("There was a error. Details could not be loaded. It could be a connection error, or - less likely - an unknown app. data,data.error: ", data,data.error);
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
                                    
                                                const shots = JSON.parse(data['versions'][v][info]);
                                                if(this.debug){
                                                    console.log("screenshots list: ", shots);
                                                }
                                                for (var s = 0; s < shots.length; s++) {
                                                    var screenshot1 = document.createElement('img');
                                                    screenshot1.style.opacity = 0
                                                    screenshot1.onload = function() {
                                                        this.style.opacity = 1;
                                                    };
                                                    screenshot1.src = this.app_store_url + shots[s];
                                                    target_element.appendChild(screenshot1);
                                                    
                                                }
                                
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
                                                var texty = document.createTextNode(text_to_use);
                                                target_element.appendChild(texty);
                                                
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
                
                    //if( !installed && data['versions'][v]["addon_id"] != undefined && data['versions'][v]["download_url"] != undefined && data['versions'][v]["checksum"] != undefined ){
                    if( !installed){
                        const cloud_item = this.get_cloud_addon_data(addon_id);
                        if(this.debug){
                            console.log("candle store debug: show_selected_app: get_cloud_addon_data -> cloud_item: ", cloud_item);
						}
                        
						if(cloud_item != null){
                            if( typeof cloud_item['addon_id'] == 'string' && typeof cloud_item['download_url'] == 'string' && typeof cloud_item["checksum"] == 'string' ){ // overkill
                                if(this.debug){
                                    console.log("candle store debug: this.addons_being_installed: ", this.addons_being_installed);
                                }
								
                                var b = document.createElement("button");
                                b.classList.add('extension-candleappstore-selected-install-button');
                                b.classList.add('extension-candleappstore-button');
                                b.textContent = "Install";
            					b.addEventListener('click', (event) => {
                                    //console.log("install button clicked");
                                    //console.log(event);
                        
                                    event.stopImmediatePropagation();
                        
                                    if(this.exhibit_mode){
                                        console.log("not installing - exhibit mode active");
										this.flash_message('Sorry, cannot install while in exhibit mode');
                                        return;
                                    }
                        
                                    event.target.style.display = 'none';
                        
                                    //selected.style.display = 'none';
                                    var already_in_being_installed_list = false;
                                    for(let x = 0; x < this.addons_being_installed.length; x++){
                                        if(this.addons_being_installed[x] == data['versions'][v]["addon_id"]){
                                            already_in_being_installed_list = true;
                                        }
                                    }
									
									if(typeof this.installing_addons_queue[data['versions'][v]["addon_id"]] != 'undefined'){
										console.log("this addon is already in the installation queue: ", data['versions'][v]["addon_id"]);
										if(typeof this.installing_addons_queue[data['versions'][v]["addon_id"]]['failed_timestamp'] == 'number'){
											b.textContent = 'Retry installing';
										}
										else{
											b.textContent = 'Already installing';
											b.disabled = true;
										}
										
										
									}
									
									
                                    if(already_in_being_installed_list == false){
                                        //this.addons_being_installed.push( data['versions'][v]["addon_id"] );
                                        if(this.debug){
                                            console.log("added addon_id to list of addons that are currently being installed: ", cloud_item["addon_id"], this.addons_being_installed);
                                        }
                                    }
                            
                            
                                    //document.getElementById("extension-candleappstore-busy-installing").style.display = 'block';
                                    //document.getElementById('extension-candleappstore-selected-main').style.display = 'none';
                        
                                    if(this.debug){
                                        console.log("data['versions'][v]: ", data['versions'][v]);
                                        console.log( "installing addon. parameters: ", cloud_item["addon_id"], cloud_item["download_url"], cloud_item["checksum"] );
                                    }
                                    const addon_slightly_nicer_name = cloud_item["addon_id"].replace('-',' ').replace('-adapter',' ').replace('-addon',' ');
                                    document.getElementById('extension-candleappstore-busy-installing-name').innerText = addon_slightly_nicer_name;
                                    document.getElementById('extension-candleappstore-selected-post-install-addon-name').innerText = addon_slightly_nicer_name;
                        			
									
									window.API.postJson(
										`/extensions/candleappstore/api/ajax`,
										{
											'action':'install_addon',
											'addon_id':cloud_item["addon_id"],
											'addon_url':cloud_item["download_url"],
											'addon_checksum':cloud_item["checksum"]
										}
									)
						            .then((body) => {
										console.warn("candle store: got install_addon response: ", body);
										if(typeof body.state == 'boolean' && body.state == true){
											this.flash_message('Succesfully requested addon to be installed');
											
							                this.selected_overlay_closed = true;
							                selected.style.display = 'none';
							                document.getElementById('extension-candleappstore-installation-failed').style.display = 'none';
							                document.getElementById('extension-candleappstore-view').style.zIndex = 'auto';
											this.view.scrollTop = 0;
											
										}
										else{
											this.flash_message('Error, request to install addon was denied');
										}
									})
									.catch((err) => {
				        				console.error("candle store: caught error requesting installation of addon: ", err);
										this.flash_message('Failed to request addon installation - connection error?');
				                        //document.getElementById("extension-candleappstore-developer-busy-installing-app").style.display = 'none';
				        			});
									
									/*
                                    window.API.installAddon( cloud_item['addon_id'], cloud_item["download_url"], cloud_item["checksum"] )
                                    .then((result) => { 
            							if(this.debug){
                                            console.log("installation result: ", result);
                                        }
                                        this.api_addons_data = []; // Remove the existing data about addons so that it will be re-requested from the window.API
                            
                                        if(typeof result.enabled != "undefined"){
                                            if(this.debug){
												console.log("addon installed succesfully");
											}
                                            this.installed.push(data['versions'][v]["addon_id"]);
                                            if(result.enabled == true){
												if(this.debug){
													console.log("candle store debug: addon is enabled");
												}
                                            }
                                            else{
												if(this.debug){
                                                	//console.log("- addon is NOT enabled");
                                                	console.log("candle store debug: addon installed ok, but is disabled?");
												}
                                            }
                                        }
                                        else{
											if(this.debug){
												console.error("candle store debug: installation failed, severely");
											}
                                            this.flash_message('Error: could not install');
                                        }
                        
                                        this.update_after_install(data['versions'][v]);
                                
                                        // Remove addon name from being installed list
                                        for (var t = this.addons_being_installed.length-1; t >= 0; t--) {
                                            if (this.addons_being_installed[t] == cloud_item["addon_id"]) {
                                                this.addons_being_installed.splice(t, 1);
                                            }
                                        }
                                        
            							if(this.debug){
                                            console.log("candle store debug:requesting fresh addon default settings");
                                        }
                                        this.update_addon_settings_defaults();
                                        

            						}).catch((err) => {
										if(this.debug){
											console.log("candle store debug: installation catch (error?): ", err);
										}
            							
                                        document.getElementById("extension-candleappstore-busy-installing").style.display = 'none';
                                        document.getElementById("extension-candleappstore-installation-failed").style.display = 'block';
                                
                                        // Remove addon name from being installed list
                                        for (var t = this.addons_being_installed.length-1; t >= 0; t--) {
                                            if (this.addons_being_installed[t] == cloud_item["addon_id"]) {
                                                this.addons_being_installed.splice(t, 1);
                                            }
                                        }
                                
            						});
									
									*/
                                });
                        
                                //console.log("adding install button");
                                if( this.installed.indexOf(data['versions'][v]["addon_id"]) == -1 ){
                                    selected_options_bar.appendChild(b);
                                }
								
                                //if( this.addons_being_installed.indexOf( data['versions'][v]["addon_id"] ) == -1 ){
                            
                                    
                        		/*
                                }
                                else{
                                    if(this.debug){
                                    	console.log('candle store debug: this addon is already being installed');
                                    }
									
                                    document.getElementById('extension-candleappstore-busy-installing-name').innerText = data['versions'][v]["addon_id"];
									//document.getElementById("extension-candleappstore-busy-installing").style.display = 'block';
                                    //document.getElementById('extension-candleappstore-selected-main').style.display = 'none';
                                }
								*/
                            }
                        }
                        else{
                            if(this.debug){
								console.error("candle store debug: somehow there was no cloud data for this addon");
							}
                            var n = document.createElement("div");
                            n.classList.add('extension-candleappstore-selected-no-install-candidate');
                            var t = document.createTextNode("Cannot install");
                            n.appendChild(t);
                            selected_options_bar.appendChild(n);
                            
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
                                    this.flash_message('Settings uninstall addons while in exhibit mode');
									
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
                                            console.log("candle store debug: uninstallation result: ", result);
                                            //console.log("addon_id: " + addon_id + " was uninstalled, in theory.");
                                        }
                                        document.getElementById("extension-candleappstore-selected").style.display = 'none';
										document.getElementById('extension-candleappstore-view').style.zIndex = 'auto';
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
                                                console.log("candle store debug: get_installed_addons_data: result: ");
                                            }
                            				//console.log(result);
                                            this.api_addons_data = result;
                                            this.generate_overview('installed'); // user might have come from either page
                                            this.generate_overview('shop');
                                            document.getElementById("extension-candleappstore-busy-uninstalling").style.display = 'none';
                                            // post-uninstall here?
                                
                            			}).catch((err) => {
                            				if(this.debug){
												console.error("candle store debug: get getInstalledAddons info catch (error?): ", err);
											}
                                            //console.log(e);
                                            document.getElementById("extension-candleappstore-busy-uninstalling").style.display = 'none';
                            			});
                                        
                                        
                                        // remove data dir
                                        if(this.debug){
                                            console.log("candle store debug: will try to remove data dir for addon: ", addon_id);
                                        }
                            			window.API.postJson(
                            				`/extensions/candleappstore/api/ajax`,
                            				{'action':'uninstall','addon_id':addon_id}
                            			)
                                        .then((body) => {
                                            if(this.debug){
                                                console.log("candle store debug: Uninstall: removed addon data dir? ", body);
                                            }
                                            if(typeof body.addon_dirs != 'undefined'){
                                                this.installed = body.addon_dirs;
                                            }
                                            
                                            
                            			})
                                        .catch((err) => {
											if(this.debug){
												console.log("candle store debug: caught error in remove addon data dir: ", err);
											}
                            				
                            			});
                                        
                            
            						}).catch((err) => {
            							if(this.debug){
											console.log("candle store debug: caught error in uninstallation: ", err);
										}
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
                
                    setTimeout(() =>{
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
                
    
                    // reveal the secondary loaded in content
                    document.getElementById('extension-candleappstore-selected-secondary').style.display = 'block';
    
                    //clone.setAttribute('data-installed', 1);
                    //var target_element = clone.querySelector( '.extension-candleappstore-basic-options' );
                    //if(page != 'updates'){
                    //    target_element.appendChild(b);
                    //}
                
                
                    //*/
                
                
                
                }
                catch(err){
					if(this.debug){
						console.log("candle store debug: caught error in show selected app: ", err);
					}
                    
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
                                var target_element = clone.querySelector( selector_name );
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
                
                }
                catch(err){
					if(this.debug){
						console.log("candle store debug: caught error in adding ratings to selected app display: ", err);
					}
                    
                }   
                
                document.getElementById('extension-candleappstore-view').style.zIndex = '3';
                
            })
            .catch((err) => {
				if(this.debug){
					console.log("candle store debug: caught error while getting detailed data about an addon: ", err);
				}
			});
            
            
             

            
        }
        
        
        
        
        
        
        //
        //  SHOW ADDON SETTINGS
        //
        
        show_addon_config(addon_id){ // ingests .schema data from self.api_addon_data
            try{
                if(this.debug){
                    console.log("candle store debug: in show_addon_config for: " + addon_id);
                    console.log("candle store debug: addon defaults: ", this.addon_defaults[addon_id]);
                }
                
                
                
                // Clean up from previous addon settings
                const pre = document.getElementById('extension-candleappstore-response-data');
                const form = document.getElementById('extension-candleappstore-settings-form');
                const advanced_form = document.getElementById('extension-candleappstore-advanced-settings-form');
                const advanced_form_container = document.getElementById("extension-candleappstore-advanced-settings-form-container");
                const settings_options_bar = document.getElementById("extension-candleappstore-settings-options");
                const permissions_dropdown = document.getElementById("extension-candleappstore-permissions");
                
                document.getElementById("extension-candleappstore-settings-title").innerText = "";
                document.getElementById('extension-candleappstore-settings-options').style.display = 'block';
                document.getElementById('extension-candleappstore-settings-geo-tip').style.display = 'none';
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
					    console.log("candle store debug: get installed_adons_data result: \n", installed_adons_data);
                    }
                    
                    window.API.getAddonConfig( addon_id )
                    .then((data) => { 
                        if(this.debug){
    					    console.log("get addon config result: ", data);
                        }
                        //console.log(data['body']);
                
                        //var spotted_advanced_setting = false;
            

                        settings_container.classList.remove("extension-candleappstore-busy");
                
                        const data_keys = Object.keys(data);
                        if(data_keys.length == 0){
                            //console.log('This addon does not have any saved preferences yet');
                            form.innerHTML = '<p>This addon does not have any saved preferences yet.</p>';
                            //return;
                            if(typeof this.addon_defaults[addon_id] != 'undefined'){
			                    if(this.debug){
								    console.log("candle store debug: no saved settings for this addon yet, but defaults are available. Swapping those in.");
                                }
                                data = this.addon_defaults[addon_id]
                                //for(let z = 0; z < data_keys.length; z++){}
                            }
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
    
                
                
                        if(addon_id == 'weather-adapter'){
                            document.getElementById('extension-candleappstore-settings-geo-tip').style.display = 'block';
                        }
                        
                
                        //console.log("addon_settings_schema:", addon_settings_schema);
                
                        const addon_settings_props = addon_settings_schema['properties'];
                        
                        var addon_settings_required = [];
                        if(addon_settings_schema.hasOwnProperty('required')){
                            addon_settings_required = addon_settings_schema['required'];
                        }
                
                        const settings_keys = Object.keys(addon_settings_props);
	                    if(this.debug){
						    console.log("candle store debug: addon_settings_props: \n", addon_settings_props);
                        }
                        //console.log("all props: " + settings_keys);
                        //console.log("addon_settings_required = " + addon_settings_required);
                
                        
                
                
                        var stop_processing = false;
                
                        // Looping over the fields defined in the api_data schema
                        settings_keys.forEach((info, index) => {
                            if(this.debug){
                                console.log("candle store debug: adding setting item: " + info);
                            }
                            
                            var advanced = false;
                            var is_required = false;
                    

                            if(stop_processing){return;} // weird that return false didn't work.



                            // Check if there is a default value available
                            if(typeof data[info] == 'undefined' && typeof this.addon_defaults[addon_id] != 'undefined'){
                                
                                if(typeof this.addon_defaults[addon_id][info] != 'undefined' && typeof this.addon_defaults[addon_id][info] != 'object'){
                                    if(this.debug){
                                        console.log("candle store debug: no stored setting for: \n", info, ". \nHowever, defaults settings are available, so swapping those in: \n", this.addon_defaults[addon_id][info]);
                                    }
                                    data[info] = this.addon_defaults[addon_id][info];
                                }else{
                                    if(this.debug){
										console.warn("candle store debug: default settings value was an object? Ignoring: ", this.addon_defaults[addon_id][info]);
									}
                                }
                                //data = this.addon_defaults[addon_id]
                                //for(let z = 0; z < data_keys.length; z++){}
                            }




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
							const cleaned_label = info.replaceAll('_',' ');
                            var t = document.createTextNode(cleaned_label);
                            l.appendChild(t); // append text to label
                
                            if(info.indexOf('atitude') != -1 || info.indexOf('ontitude') != -1 || info.toLowerCase() == 'lat' || info.toLowerCase() == 'lon'){
                                if(this.debug){
                                    console.log("candle store debug: detected lat/lon input, inout name: ", info);
                                }
                                document.getElementById('extension-candleappstore-settings-geo-tip').style.display = 'block';
                            }
                            
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
									description = description.substring(9);
									description = description.trim();
                                    //description = description.replace('Advanced. ','');
                                    //description = description.replace('Advanced.','');
                                }
                                //console.log(description);
                        
                                var pt = document.createTextNode(description);
                                p.appendChild(pt); // append description text to paragraph
                            }
                    
                            //d.appendChild(p);
                    
                            if(this.debug){
                                console.log("\n\ncandle store debug: creating input: ", addon_settings_props[info]);
                                console.log("candle store debug: stored preference: ", data[info]);
                            }
                            
                            
                            try{
                                
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
                                    if(info.toLowerCase().startsWith('debug') || info.toLowerCase().startsWith('more debug')){
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
                                    
                                    var s_min_max_container_el = null;
                                    
                                    var input_type = 'text';
                                    if(addon_settings_props[info]['type'] != "string"){
                                        if(addon_settings_props[info]['type'] == "integer" || addon_settings_props[info]['type'] == "number"){
                                            input_type = "number";
                                            if(typeof addon_settings_props[info]['minimum'] != 'undefined' && typeof addon_settings_props[info]['maximum'] != 'undefined'){
                                                input_type = "range";
                                                
                                                // Create the element that shows the currently selected slider value
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
                                                
                                                // Create minimum and maximum slider values indicator div
                                                var s_min_el = document.createElement("div");
                                                s_min_el.innerText = addon_settings_props[info]['minimum'];
                                                var s_max_el = document.createElement("div");
                                                s_max_el.innerText = addon_settings_props[info]['maximum'];
                                                
                                                s_min_max_container_el = document.createElement("div");
                                                s_min_max_container_el.classList.add('extension-candleappstore-range-input-min-max');
                                                s_min_max_container_el.append(s_min_el);
                                                s_min_max_container_el.append(s_max_el);
                                                
                                                sv.classList.add('extension-candleappstore-range-input-value');
                                                
                                                
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
                        
                                    if(s_min_max_container_el != null){
                                        d.appendChild(s_min_max_container_el); // append range slider minimum and maximum values if available
                                    }
                        
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
                                    document.getElementById('extension-candleappstore-view').style.zIndex = 'auto';
									
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
								this.flash_message('Settings cannot be changed while in exhibit mode');
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
                                            console.log("candle store debug: fell through, likely a string type: ", addon_settings_props[info]['type'] + " value: ", value);
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
                                                console.log("andle store debug: warning, required value was not filled");
                                            }
                                            missing_value = true;
                                            target_element.classList.add("extension-candleappstore-settings-empty-warning"); 
                                        }
                                        new_data[info] = value;

                                    }
                           
                                    //console.log("new_data[info] = " + new_data[info]);
                    
                                }
                                catch(err){
                                    if(this.debug){
										console.log("candle store debug: caught error extracting setting value: ", err);
									}
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
                                    console.log("candle store debug: saving config for: ", addon_id);
                                    console.log("candle store debug: new config data: ", new_data);
                                }
                                //window.API.setAddonConfig( addon_id, JSON.stringify(new_data) )
                                window.API.setAddonConfig( addon_id, new_data )
                                .then(() => { 
            						if(this.debug){
                                        console.log("andle store debug: saved settings result for addon: " + addon_id);
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
                                    
            					}).catch((err) => {
            						if(this.debug){
										console.log("candle store debug: caught error in setAddonConfig: ", err);
									}
                                    document.getElementById("extension-candleappstore-settings").style.display = 'none';
									document.getElementById('extension-candleappstore-view').style.zIndex = 'auto';
                                    document.getElementById('connectivity-scrim').classList.add('hidden');
									
									this.flash_message('There was a connection error while saving the settings. Please verify that they were saved correctly.');
									
            					});
                        
                            }
                            else{
								this.flash_message('A required value was not filled in and/or selected');
								
                            }
                    
                        });
                
                
                        settings_options_bar.appendChild(b);
                    
            
    				})
                    .catch((err) => {
                        if(this.debug){
                            console.log("candle store debug: caught error in get addon config: ", err);
						}
						this.flash_message('Connection error, could not load setting. PLease try again.');
						
    				});
				})
                .catch((err) => {
					if(this.debug){
						console.log("candle store debug: caught error in get addons overview: ", err);
					}
				});
                
                // get a z-index above the main menu button while overlay with back button is active
                document.getElementById('extension-candleappstore-view').style.zIndex = '3';
                
                
            }
            catch(err){
                if(this.debug){
					console.error("candle store debug: caught error in show_addon_config: ", err);
				}
				document.getElementById('extension-candleappstore-view').style.zIndex = 'auto';
            }
            
        }
        
		
		
		
		
		
		//
		//  DEVELOPER TAB
		//
        
		show_developer_tab(subtab){
			if(this.debug){
				console.log("candle store debug: in show_developer_tab. subtab: ", subtab);
			}
			
			this.developer_subtab = subtab;
			
			const subtab_els = this.view.querySelectorAll('.extension-candleappstore-tab-developer-subtab');
			for (const subtab_el of subtab_els) {
			    // dconsole.log("subtab_el: ", subtab_el);
				if(subtab_el.getAttribute('id').endsWith(subtab)){
					subtab_el.classList.remove('extension-candleappstore-hidden');
				}else{
					subtab_el.classList.add('extension-candleappstore-hidden');
				}
			}
			
			
			if(subtab == 'things'){
				this.show_things_attributes();
			}
			
			
            // Create interval for internal log display
            if(subtab == 'log' && this.log_poll_interval == null){
    			this.log_poll_interval = setInterval(() => {
                
                    // Create a live updating display of the internal log
                    if(this.get_log_tail && this.current_page == 'developer' && this.developer_subtab == 'log' && this.busy_log_polling == false){
                        this.busy_log_polling = true;
                    
                    
                        // /poll
        		        window.API.postJson(
        		          `/extensions/${this.id}/api/ajax`,
                            {'action':'log_poll'}
        		        )
						.then((body) => {
                            if(this.debug){
                                console.log("candle store debug: candle store internal log poll response: ", body);
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
                            this.busy_log_polling = false;
                    
            		        
                        })
                        .catch((err) => {
                            if(this.debug){
								console.log("candle store debug: caught error doing internal logs poll: ", err);
							}
                            this.busy_log_polling = false;
                        })
                    }
                
    			}, 1000);
            }
			
		}
		
		
		show_things_attributes(){
			API.getThings()
			.then((things) => {
				
				if(this.debug){
					//console.log("candle store debug: show_things_attributes (developer tab): got fresh things list from API: ", things);
				}
				
				const filter = this.view.querySelector('#extension-candleappstore-developer-things-filter-input').value;
				if(this.debug){
					console.log("candle store debug: filtering things: filter: ", filter);
				}
				
				
                function compare(a, b) {
        
					const thingA = a.title.toUpperCase();
					const thingB = b.title.toUpperCase();

					if (thingA > thingB) {
						return 1;
					} else if (thingA < thingB) {
						return -1;
					}
					return 0;
                }
				
				if(Object.keys(things).length == 0){
					return
				}
                things.sort(compare);
                if(this.debug){
					//console.log("candle store debug: developer tab: sorted things: ", things);
				}
				
				// remove values to protect privacy
				
				/*
				function cleanObject(obj) {
				    for (const key in obj) {
				        if (obj[key] === null || obj[key] === undefined) {
				            delete obj[key];
				        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
				            cleanObject(obj[key]);
				            // Remove the key if the object is empty after cleaning
				            if (Object.keys(obj[key]).length === 0) {
				                delete obj[key];
				            }
				        }
				    }
				    return obj;
				}
				*/
				
				
				function remove_values(obj) {
				    for (const key in obj) {
						if(key == 'value'){
							delete obj[key];
						}
				        else if (typeof obj[key] === 'object') {
				            remove_values(obj[key]);
				        }
				    }
				}
				remove_values(things);
				this.all_things = things;
				
				
				if(typeof filter == 'string' && filter.length > 2){
					
					function filterObj(obj,filter) {
						//console.log("filterObj: looking for: ", filter);
						let found_something = false;
					    for (const key in obj) {
							if(typeof obj[key] == 'string' && obj[key].indexOf(filter) != -1){
								//console.log("filter thing: spotted: ", filter, obj[key]);
								found_something = true;
								break
							}
					        else if (found_something == false && typeof obj[key] === 'object' && obj[key] !== null) {
					            found_something = filterObj(obj[key], filter);
					        }
					    }
					    return found_something;
					}
					
					let filtered_things = [];
					for (const thing in things) {
						//console.log("filter & thing: ", filter, things[thing]);
						if(filterObj(things[thing],filter)){
							filtered_things.push(things[thing]);
						}
						
					}
					//console.log("filtered_things: ", filtered_things);
					this.view.querySelector('#extension-candleappstore-developer-things-filter-result-meta').textContent = 'Found ' + filtered_things.length + ' matching things';
					
				
					this.view.querySelector('#extension-candleappstore-developer-things-attributes').textContent = JSON.stringify(filtered_things,null,4);
				}
				else{
					this.view.querySelector('#extension-candleappstore-developer-things-filter-result-meta').textContent = 'Showing all ' + things.length + ' things';
					this.view.querySelector('#extension-candleappstore-developer-things-attributes').textContent = JSON.stringify(things,null,4);
					
				}
				
    			
			})
			.catch((err) => {
				if(this.debug){
					console.error("candle store debug: developer tab: caught error in show_things_attributes: ", err);
				}
			})
			
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
		
		
		flash_message(message){
			if(typeof message == 'string' && message.length){
				const flash_message_el = this.view.querySelector('#extension-candleappstore-flash-message-container');
				if(flash_message_el){
					flash_message_el.innerHTML = '<h3>' + message + '</h3>';
					setTimeout(() => {
						flash_message_el.innerHTML = '';
					},3000);
				}
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
		
		/*
		split_version(long_version_number) {
			let version_parts = {'major'}
			if(typeof long_version_number == 'string'){
				long_version_number = parseInt(long_version_number);
			}
			if(typeof long_version_number == 'number'){
				long_version_number = math.round(long_version_number);
			}
			
			
		}
        */
        
        
        // update addon settings defaults
        update_addon_settings_defaults = () =>
        {
            return new Promise((myResolve, myReject) =>
            {
    	        window.API.postJson(
    	            `/extensions/${this.id}/api/ajax`,
    			    {'action':'get_installed_dirs'}

    	        ).then((body) => {
                    //console.log("get_installed_dirs response: ", body);
    				if(body['state'] == true){
                        
                        // Update all the values in a central method
                        this.parse_body(body);
                        
                        myResolve( body.addon_defaults );
    				}
    				else{
                        myReject({});
    				}

    	        }).catch((e) => {
                    if(this.debug){
                        console.error("candle store: error calling addon api for get_installed_dirs: ", e);
                    }
                    myReject({});
    	        });	
            
            });
        };
        
		
		addon_jump(addon_to_jump_to=null){
			if(addon_to_jump_to == null){
				addon_to_jump_to = this.jump_to_addon;
			}
			if(addon_to_jump_to == ''){
                if(this.debug){
                    console.warn("addon_jump: no addon to jump to provided");
                }
				return
			}
			console.log("addon_jump: jumping to: ", addon_to_jump_to);
			
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
    
    
	new Candleappstore();
	
})();


