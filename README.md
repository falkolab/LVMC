# LVMC
Multicolumn ListView helper library

[![License](http://img.shields.io/badge/license-MIT-orange.svg)](http://mit-license.org)
[![GitHub issues](https://img.shields.io/github/issues/falkolab/LVMC.svg)](https://github.com/falkolab/LVMC/issues)

## Overview

This module allows you to implement multicolumn ListView with the Appcelerator Titanium SDK.

It uses the Titanium ListView.

![screenshot1](screenshot.png?raw=true "Example screenshot")

## Installation
### Get it [![gitTio](http://gitt.io/badge.png)](http://gitt.io/component/com.falkolab.lvmc)
Download the latest distribution ZIP-file and consult the [Titanium Documentation](http://docs.appcelerator.com/titanium/latest/#!/guide/Using_a_Module) on how install it, or simply use the [gitTio CLI](http://gitt.io/cli):

`$ gittio install com.falkolab.lvmc`

## API

This module uses and wrap the [Ti.UI.ListView API](http://docs.appcelerator.com/titanium/3.0/#!/api/Titanium.UI.ListView).

## Additional parameters

The ListView object extended by these custom parameters:

* `columns` _number_ (creation only) - sets the maximum columns count in sections

The ListSection object extended by these custom parameters:
* `columns` _number_ (creation only) - sets the exact columns count for this section. Must be **equal or less** than same parameter of ListView.
* `defaultItemTemplate` _string_ (creation only) - default template for items. **Must** be defined if you define `columns`.

## Events

You must call `transformEvent` function if you want to get `itemIndex`, `bindId`, `firstVisibleItemIndex`, `visibleItemCount`, `firstVisibleItem` from property.

Example:

    list.addEventListener('itemclick', function(evt) {
        require('com.falkolab.lvmc').transformEvent(evt);
        alert('`itemclick` event:\n'+ JSON.stringify(_.omit(evt, 'source', 'section'), null, '\t'));
    });

## Methods

You can use similar helper methods from this library like ListView/ListSection but place `list` or `section` instance as first parameter.

### ListView methods

Look at the docs but use ListView instance as first argument.
[Titanium.UI.ListView](http://docs.appcelerator.com/platform/latest/#!/api/Titanium.UI.ListView).

Supported helpers: `appendSection`, `setMarker`, `addMarker`

Example:

    var lvmc = require('com.falkolab.lvmc');
    lvmc.setItems(section, items);

Or use wrapper:

    section = lvmc.wrap(section)
    section.setItems(items);
    section = null;

### ListSection methods

Look at the docs but use ListSection instance as first argument.
[Titanium.UI.ListSection](http://docs.appcelerator.com/platform/latest/#!/api/Titanium.UI.ListSection).

Supported helpers: `setItems`, `getItems`, `getItemAt`, `appendItems`, `insertItemsAt`, `replaceItemsAt`, `deleteItemsAt`, `updateItemAt`

You **must not** use `section.items` property if you define `columns` for it. Use `lvmc.setItems` instead. Look at example above.

## Features:

* Different templates for items in same multicolumn section.
* Several sections with different columns amount.
* Add, replace, insert, delete etc items from multicolumn section.
* Use single column and multicolumn sections same time.

You can't:
* ?

# Demo applications

For additional info please Look at demo applications:

* [Alloy demo](https://github.com/falkolab/LVMC-Demo-Alloy-App)
* [Classic demo](https://github.com/falkolab/LVMC-Demo-Classic-App)

## License

MIT

Copyright 2016 Andrey Tkachenko aka falkolab
