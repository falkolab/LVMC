/* Multicolumn ListView helper library for Titanium SDK
 *
 * Copyright (C) 2016 Tkachenko Andrey
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE file for details.
 */

exports.createListView = function(opts) {
	if (opts.sections) {
		_.each(opts.sections, function(sectionOpts) {
			if (!opts.columns) {
				throw "You must define `columns` property in ListView. It can be same value or greater.";
			} else if (opts.columns < sectionOpts.columns) {
				throw "ListView.columns property must be greater or equal ListViewSection.columns";
			}
		});
	}

	if (!opts.columns) return Ti.UI.createListView(opts);

	// to preserve original options unchanged
	opts = _.extend({}, opts);
	var columns = opts.columns || 1;

	if (!_.isEmpty(opts.templates)) {
		var templates = transformTemplates(opts.templates, columns);

		// to preserve original templates set to be unchanged
		opts.templates = _.extend({}, opts.templates, templates);


		if (Ti.Platform.osname == 'android') {
			for (var binding in opts.templates) {
				var currentTemplate = opts.templates[binding];
				//process template
				processTemplate(currentTemplate);
				//process child templates
				processChildTemplates(currentTemplate);
			}
		}
	}

	// do not omit additional properties because they needed for validation etc
	return Ti.UI.createListView(opts);
};


exports.createListSection = function(opts) {
	if (!opts.columns) return Ti.UI.createListSection(opts);

	// do not omit additional properties because they needed for validation etc
	var section = Ti.UI.createListSection(_.omit(opts, 'items'));

	if(opts.items) {
		this.setItems(section, opts.items);
	}
	return section;
};

exports.DIVIDER = '@';

exports.wrap = function(obj) {
	var methods;
	if(obj.apiName == 'Ti.UI.ListSection') {
		methods = ['setItems', 'getItems', 'getItemAt', 'appendItems', 'insertItemsAt', 'replaceItemsAt', 'deleteItemsAt', 'updateItemAt'];
	} else if(obj.apiName == 'Ti.UI.ListView') {
		methods = ['appendSection', 'setMarker', 'addMarker'];
	}
    var self = this;
	if(methods) {
		return _.extend({obj: obj}, _.chain(methods).map(function(methodName) {
			return [methodName, function() {
				return self[methodName].apply(self, [this.obj].concat(Array.prototype.slice.call(arguments)));
			}];
		}).object().value());
	}
};

// ***********************
// ListView support helpers
// ***********************
exports.appendSection = function(listview, section, animation) {
	if (!listview.columns) {
		throw "You must define `columns` property in ListView. It can be same value or greater.";
	} else if (listview.columns < section.columns) {
		throw "ListView.columns property must be greater or equal ListViewSection.columns";
	}

	listview.appendSection(section, animation);
};

function setAddMarker(funcName, listview, markerProps, columns /* optional */) {
	var section = listview.sections[markerProps.sectionIndex];
	columns = columns || section.columns;
	if(columns) {
		markerProps = {
			sectionIndex: markerProps.sectionIndex,
			itemIndex: Math.floor(markerProps.itemIndex/columns)
		};
	}
	listview[funcName](markerProps);
}

exports.setMarker = _.partial(setAddMarker, 'setMarker');
exports.addMarker = _.partial(setAddMarker, 'addMarker');

exports.transformEvent = function(evt, columns /* optional */) {
	if(evt.transformed === true) return;
	if(evt.type == 'move') {
		Ti.API.warn('targetItemIndex property was not corrected.');
	}

	if(evt.section) {
		var section = evt.section;

		columns = columns || evt.section.columns;
		if(columns) {
			if(evt.bindId) {
				var parts = evt.bindId.split('@');
				if(parts.length == 2) {
					evt.bindId = parts[0];
					if(evt.hasOwnProperty('itemIndex')) {
						evt.itemIndex = evt.itemIndex * columns + parseInt(parts[1]);
					}
				}
			}
		}
	}

	if(['scrollend', 'scrollstart'].indexOf(evt.type) >-1) {
		columns = columns || evt.firstVisibleSection.columns;
		if(columns) {
			evt.firstVisibleItemIndex = evt.firstVisibleItemIndex * columns;
			evt.visibleItemCount = Math.min(evt.firstVisibleSection.getItems().length - evt.firstVisibleItemIndex,
				evt.visibleItemCount * columns);
			evt.firstVisibleItem = evt.firstVisibleSection.getItemAt(evt.firstVisibleItemIndex);
		}
	}

	evt.transformed = true;
};

// ***********************
// ListSection support helpers
// ***********************

exports.setItems = function(section, items, columns /* optional */, defaultItemTemplate /* optional */) {
	columns = columns || section.columns;
	defaultItemTemplate = defaultItemTemplate || section.defaultItemTemplate;
	if(columns) {
		validateNotTransformedItems(items);
		items = transformDataItems(items, columns, defaultItemTemplate);
	}
	//printDebug(items, 'dataItems.json');
	section.setItems(items);
};

exports.getItems = function(section) {
	return clone(Array.prototype.concat.apply([], _.map(section.getItems(), function(item) {
			return item.properties.originalItems;
		})
	));
};

exports.getItemAt = function(section, itemIndex, columns /* optional */) {
	columns = columns || section.columns;
	var internalIndex = Math.floor(itemIndex / columns),
	   offset = itemIndex % columns;

	return section.getItems()[internalIndex].properties.originalItems[offset];
};

exports.appendItems = function(section, items, animation, columns /* optional */, defaultItemTemplate /* optional */) {
	columns = columns || section.columns;
	defaultItemTemplate = defaultItemTemplate || section.defaultItemTemplate;
	if(columns) {
		if(!items.length) return;
		validateNotTransformedItems(items);

		var offset = 0, currentItems = section.getItems(), last = _.last(currentItems);
		if(last) {
			offset = columns % last.properties.originalItems.length;
			if(offset) {
				items = _.clone(items);
				var firstChunk = items.splice(0, offset);
				var orig = clone(last.properties.originalItems);
				var transformed = transformDataItems(orig.concat(firstChunk), columns, defaultItemTemplate);
				if(transformed) {
					section.replaceItemsAt(currentItems.length-1, 1, transformed);
				}
			}
		}
		items = transformDataItems(items, columns, defaultItemTemplate);
	}

	section.appendItems(items, animation);
};

exports.insertItemsAt = function(section, itemIndex, dataItems, animation, columns /* optional */, defaultItemTemplate /* optional */) {
	columns = columns || section.columns;
	defaultItemTemplate = defaultItemTemplate || section.defaultItemTemplate;

	if(columns) {
		if(!dataItems.length) return;
		validateNotTransformedItems(dataItems);

		var internalIndex = Math.floor(itemIndex/columns),
			offset = itemIndex % columns, currentItems = section.items;

		section.deleteItemsAt(internalIndex, currentItems.length - internalIndex);

		var itemsForRebuild = currentItems.splice(internalIndex);

		var originalItems = Array.prototype.concat.apply([],
			_.map(itemsForRebuild, function(item) {
				return item.properties.originalItems;
			})
		);

		originalItems.splice.apply(originalItems, [offset, 0].concat(dataItems));
		exports.appendItems(section, originalItems, animation, columns, defaultItemTemplate);
	} else {
		section.insertItemsAt(itemIndex, dataItems, animation);
	}
};

exports.replaceItemsAt = function(section, itemIndex, count, dataItems, animation, columns /* optional */, defaultItemTemplate /* optional */) {
	columns = columns || section.columns;
	defaultItemTemplate = defaultItemTemplate || section.defaultItemTemplate;

	if(columns) {
		count = count || 0;
		validateNotTransformedItems(dataItems);

		var internalIndex = Math.floor(itemIndex/columns),
			offset = itemIndex % columns,
			currentItems = section.getItems();

		section.deleteItemsAt(internalIndex, currentItems.length - internalIndex,
			// need animation if called from deleteItemsAt
			dataItems.length === 0 ? animation: undefined);

		var itemsForRebuild = currentItems.splice(internalIndex);

		var originalItems = Array.prototype.concat.apply([],
			_.map(itemsForRebuild, function(item) {
				return item.properties.originalItems;
			})
		);

		originalItems.splice.apply(originalItems, [offset, count].concat(dataItems));

		exports.appendItems(section, originalItems,
			// NOT need animation if called from deleteItemsAt
			dataItems.length === 0 ? undefined: animation, columns, defaultItemTemplate);
	} else {
		section.appendItems(itemIndex, count, dataItems, animation);
	}
};

exports.deleteItemsAt =  function(section, itemIndex, count, animation, columns /* optional */, defaultItemTemplate /* optional */) {
	columns = columns || section.columns;
	defaultItemTemplate = defaultItemTemplate || section.defaultItemTemplate;

	if(columns) {
		exports.replaceItemsAt(section, itemIndex, count, [], animation, columns /* optional */, defaultItemTemplate /* optional */);
	} else {
		section.deleteItemsAt(itemIndex, count, animation);
	}
};

exports.updateItemAt = function(section, index, dataItem, animation, columns /* optional */, defaultItemTemplate /* optional */) {
	columns = columns || section.columns;
	defaultItemTemplate = defaultItemTemplate || section.defaultItemTemplate;

	if(columns) {
		validateNotTransformedItems([dataItem]);
		var internalIndex = Math.floor(index/columns),
			offset = index % columns;

		var originalItems = section.getItemAt(internalIndex).properties.originalItems;
		originalItems.splice(offset, 1, dataItem);

		var transformed = transformDataItems(originalItems, columns, defaultItemTemplate);
		section.updateItemAt(internalIndex, transformed[0], animation);
	} else {
		section.updateItemAt(index, dataItem, animation);
	}
};

function printDebug(data, fileName) {
	//return;
	if (Ti.App.deployType == "development") {
		var file = Titanium.Filesystem.getFile(Titanium.Filesystem.applicationDataDirectory, fileName);
		file.write(JSON.stringify(data, null, '\t'));
		file = null;
		//alert(JSON.stringify(data, null, '\t'));
		//Ti.API.info(JSON.stringify(data, null, '\t'));
	}
}

function clone(obj) {
	var copy;
	var omit = Array.prototype.slice.call(arguments, 1);

	// Handle the 3 simple types, and null or undefined
	if (null === obj || "object" != typeof obj)
		return obj;

	// Handle Date
	if ( obj instanceof Date) {
		copy = new Date();
		copy.setTime(obj.getTime());
		return copy;
	}

	// Handle Array
	if ( obj instanceof Array) {
		copy = [];
		for (var i = 0,
		    len = obj.length; i < len; i++) {
			copy[i] = clone.apply(null, [obj[i]].concat(omit));
		}
		return copy;
	}

	// Handle Object
	if ( obj instanceof Object) {
		copy = {};
		for (var attr in obj) {
			if(omit && omit.indexOf(attr)>=0) {
				continue;
			}
			if (obj.hasOwnProperty(attr))
				copy[attr] = clone.apply(null, [obj[attr]].concat(omit));
		}
		return copy;
	}

	throw new Error("Unable to copy obj! Its type isn't supported.");
}

function validateNotTransformedItems(items) {
	_.each(items, function(item) {
		if(item.template && item.template.lastIndexOf('extlist@',0) === 0)
			throw "Probably you use methods from `section` instance to obtain items. You must use exported functions from this library for that.";
	});
}

function transformDataItems(items, columns, defaultItemTemplate) {
	// to preserve original items unchanged
	//items = clone(items);

	if(!defaultItemTemplate) {
		_.each(items, function(item) {
			if (!_.has(item, 'template')) {
				throw "You must to set defaultItemTemplate for section or for each items";
			}
		});
	}

	var chunks = _.chain(items).groupBy(function(element, index) {
		return Math.floor(index / columns);
	}).toArray().value();

	return _.map(chunks, function(itemsChunk) {
		var dataItem = {
			template : 'extlist@' + _.map(itemsChunk, function(item) {return item.template || defaultItemTemplate;}).join(exports.DIVIDER),
			properties : {
				originalItems: itemsChunk,
				height: Ti.UI.SIZE
			}
		};

		for (var i = 0, l = itemsChunk.length; i < l; i++) {
		   	// WARN: references to original `item` object is preserved here
			var sourceItem = itemsChunk[i];

			for (var attr in sourceItem) {
				if(attr == 'properties' || attr == 'template') continue;
				dataItem[attr + exports.DIVIDER + i] = sourceItem[attr];
			}

			if (sourceItem.properties) {
				dataItem['itemContainer@' + i] = sourceItem.properties;
			}
		}
		return dataItem;
	});
}

function transformTemplates(templates, columns) {
	function renameBindIds(template, suffix, index) {
		index = index || 0;

		if(template.bindId) {
			if(template.bindId.split(exports.DIVIDER).length!==2) {
				template.bindId = template.bindId + suffix;
			}
		} else {
			// it need for index conversion in fixEvent
			template.bindId = 'extlist@' + (index++) + suffix;
		}

		if (template.childTemplates) {
			_.each(template.childTemplates, function(template) {
				renameBindIds(template, suffix, index);
			});
		}
	}

	function combinator(source, n) {
		var matrix = [];
		while (n--) {
			matrix.push(source);
		}

		return matrix.reduceRight(function(combination, x) {
			var result = [];
			x.forEach(function(a) {
				combination.forEach(function(b) {
					result.push([a].concat(b));
				});
			});
			return result;
		});
	}

	var names = Object.keys(templates);

	var result = [];
	for (var n = 1; n <= columns; n++) {
        /* jshint -W083 */
		result.push.apply(result, _.chain(combinator(names, n)).map(function(combination, rowIndex) {
			if(!_.isArray(combination)) {
				combination = [combination];
			}
			var name = 'extlist@' + combination.join(exports.DIVIDER);
			var containerTemplate = {
				type : 'Ti.UI.View',
				bindId : 'rowContainer@' + rowIndex,
				properties : {
					layout : 'horizontal',
					horizontalWrap : false,
					width : Ti.UI.FILL,
					height : Ti.UI.SIZE
					//name: name
				}
			};

			var template = {
				properties : {
					name : name,
					id: name
				},
				childTemplates : [containerTemplate]
			};

			// if (names.length == 1) {
				// _.extend(template.properties, _.omit(clone(templates[names[0]].properties), 'name'));
			// }

			containerTemplate.childTemplates = _.map(combination, function(templateName, index) {
				var itemContainerTemplate = {
					type : 'Ti.UI.View',
					bindId : 'itemContainer@' + index,
					properties : {
						height : Ti.UI.SIZE,
						width : Ti.UI.SIZE
					}
				};

				var childTemplates = templates[templateName].childTemplates;
				if (childTemplates) {
					childTemplates = clone(childTemplates, 'tiProxy' /*omit this property*/);
					itemContainerTemplate.childTemplates = childTemplates;
				}

				renameBindIds(itemContainerTemplate, exports.DIVIDER + index);
				return itemContainerTemplate;
			});

			return [name, template];
		}).value());
        /* jshint +W083 */
	}
	return _.object(result);
}


//******************
// Android Platform code
//Create ListItemProxy, add events, then store it in 'tiProxy' property
function processTemplate(properties) {
	var cellProxy = Titanium.UI.createListItem();
	properties.tiProxy = cellProxy;
	var events = properties.events;
	addEventListeners(events, cellProxy);
}

//Recursive function that process childTemplates and append corresponding proxies to
//property 'tiProxy'. I.e: type: "Titanium.UI.Label" -> tiProxy: LabelProxy object
function processChildTemplates(properties) {
	if (!properties.hasOwnProperty('childTemplates'))
		return;

	var childProperties = properties.childTemplates;
	if (childProperties ===	void 0 || childProperties === null)
		return;

	for (var i = 0; i < childProperties.length; i++) {
		var child = childProperties[i];
		var proxyType = child.type;
		if (proxyType !== void 0 && child.tiProxy === void 0) {
			var creationProperties = child.properties;
			var creationFunction = lookup(proxyType);
			var childProxy;
			//create the proxy
			if (creationProperties !== void 0) {
				childProxy = creationFunction(creationProperties);
			} else {
				childProxy = creationFunction();
			}
			//add event listeners
			var events = child.events;
			addEventListeners(events, childProxy);
			//append proxy to tiProxy property
			child.tiProxy = childProxy;
		}

		processChildTemplates(child);
	}
}

//add event listeners
function addEventListeners(events, proxy) {
	if (events !== void 0) {
		for (var eventName in events) {
			proxy.addEventListener(eventName, events[eventName]);
		}
	}
}

//convert name of UI elements into a constructor function.
//I.e: lookup("Titanium.UI.Label") returns Titanium.UI.createLabel function
function lookup(name) {
	var lastDotIndex = name.lastIndexOf('.');
    /* jshint -W061 */
	var proxy = eval(name.substring(0, lastDotIndex));
    /* jshint +W061 */
	if ( typeof (proxy) === undefined)
		return;

	var proxyName = name.slice(lastDotIndex + 1);
	return proxy['create' + proxyName];
}
