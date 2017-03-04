/* Timetable for Trains Module */

/* Magic Mirror
 * Module: SwissTransport
 *
 * By Benjamin Angst http://www.beny.ch
 * based on a Script from Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 */

Module.register("trainconnections",{

	// Define module defaults
	defaults: {
		maximumEntries: 6, // Total Maximum Entries
		updateInterval: 5 * 60 * 1000, // Update every 5 minutes.
		animationSpeed: 2000,
		fade: true,
		fadePoint: 0.25, // Start on 1/4th of the list.
                initialLoadDelay: 0, // start delay seconds.
		
                apiBase: 'http://transport.opendata.ch/v1/connections',
                from: "Oberrieden",
                to: "Dietikon",
		
		showDepartureTime: true,
		showArrivalTime: true,
		showDurationTime: true,
                showFrom: true,
		showTo: true,
		
		timePrefix: "(",
		timeSuffix: ")",
		durationPrefix: "/",
		durationSuffix: "",
		fromToSeparator: "-",
		
		titleReplace: {
			"Zeittabelle ": ""
		},
	},

	// Define required scripts.
	getStyles: function() {
		return ["trainconnections.css", "font-awesome.css"];
	},

	// Define required scripts.
	getScripts: function() {
		return ["moment.js"];
	},

	// Define start sequence.
	start: function() {
		Log.info("Starting module: " + this.name);

		// Set locale.
		moment.locale(config.language);

                this.trains = [];
		this.loaded = false;
		this.scheduleUpdate(this.config.initialLoadDelay);

		this.updateTimer = null;

	},    
    
	// Override dom generator.
	getDom: function() {
		var wrapper = document.createElement("div");

		if (this.config.from === "") {
			wrapper.innerHTML = "Please set the correct Departure-Station name: " + this.name + ".";
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if (this.config.to === "") {
			wrapper.innerHTML = "Please set the correct Final-Station name: " + this.name + ".";
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if (!this.loaded) {
			wrapper.innerHTML = "Loading trains ...";
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		var table = document.createElement("table");
		table.className = "small";

		for (var t in this.trains) {
			var trains = this.trains[t];

			var row = document.createElement("tr");
			table.appendChild(row);
                        
			if(this.config.showFrom) this.addCell(row, trains.from, "from");
			if(this.config.showDepartureTime) this.addCell(row, this.config.timePrefix + trains.departuretime + this.config.timeSuffix, "departuretime");
			
			if(this.config.showTo) this.addCell(row, this.config.fromToSeparator + trains.to, "align-right trainto");
                        if(this.config.showArrivalTime) this.addCell(row, this.config.timePrefix + trains.arrivaltime + this.config.timeSuffix, "arrivaltime");

                        if(trains.delay) {
				this.addCell(row, "+" + trains.delay + " min", "delay red");
                        } else {
                            	this.addCell(row, trains.delay + " min", "delay red");
                        }

			if(this.config.showDuration) this.addCell(row, this.config.durationPrefix + trains.duration + this.config.durationSuffix, "align-right duration")

			if (this.config.fade && this.config.fadePoint < 1) {
				if (this.config.fadePoint < 0) {
					this.config.fadePoint = 0;
				}
				var startingPoint = this.trains.length * this.config.fadePoint;
				var steps = this.trains.length - startingPoint;
				if (t >= startingPoint) {
					var currentStep = t - startingPoint;
					row.style.opacity = 1 - (1 / steps * currentStep);
				}
			}

		}

		return table;
	},

	addCell: function(row, html, class){
		var cell = document.createElement("td");
		cell.innerHTML = html;
		cell.className = class;
		row.appendChild(cell);
	},
	
	/* updateTimetable(compliments)
	 * Requests new data from openweather.org.
	 * Calls processTrains on succesfull response.
	 */
	updateTimetable: function() {
		var url = this.config.apiBase + this.getParams();
		var self = this;
		var retry = true;

		var trainRequest = new XMLHttpRequest();
		trainRequest.open("GET", url, true);
		trainRequest.onreadystatechange = function() {
			if (this.readyState === 4) {
				if (this.status === 200) {
					self.processTrains(JSON.parse(this.response));
				} else if (this.status === 401) {
					self.config.id = "";
					self.updateDom(self.config.animationSpeed);

					Log.error(self.name + ": Incorrect waht so ever...");
					retry = false;
				} else {
					Log.error(self.name + ": Could not load trains.");
				}

				if (retry) {
					self.scheduleUpdate((self.loaded) ? -1 : self.config.retryDelay);
				}
			}
		};
		trainRequest.send();
	},

	/* getParams(compliments)
	 * Generates an url with api parameters based on the config.
	 *
	 * return String - URL params.
	 */
	getParams: function() {
		var params = "?";
                params += "from=" + this.config.from;
                params += "&to=" + this.config.to;
                params += "&page=0";
		params += "&limit=" + this.config.maximumEntries;
                
		return params;
	},

	/* processTrains(data)
	 * Uses the received data to set the various values.
	 *
	 * argument data object - Weather information received form openweather.org.
	 */
	processTrains: function(data) {

		this.trains = [];

		for (var i = 0, count = data.connections.length; i < count; i++) {

			var trains = data.connections[i];
			this.trains.push({

				departuretime: moment(trains.from.departureTimestamp * 1000).format("HH:mm"),
                                arrivaltime: moment(trains.to.arrivalTimestamp * 1000).format("HH:mm"),
                                duration: moment.utc((trains.to.arrivalTimestamp-trains.from.departureTimestamp)*1000).format("HH:mm"),
				delay: trains.from.delay,
				from: trains.from.station.name,
				to: trains.to.station.name
			});
		}

		this.loaded = true;
		this.updateDom(this.config.animationSpeed);
	},

	/* scheduleUpdate()
	 * Schedule next update.
	 *
	 * argument delay number - Milliseconds before next update. If empty, this.config.updateInterval is used.
	 */
	scheduleUpdate: function(delay) {
		var nextLoad = this.config.updateInterval;
		if (typeof delay !== "undefined" && delay >= 0) {
			nextLoad = delay;
		}

		var self = this;
		clearTimeout(this.updateTimer);
		this.updateTimer = setTimeout(function() {
			self.updateTimetable();
		}, nextLoad);
	},

});
