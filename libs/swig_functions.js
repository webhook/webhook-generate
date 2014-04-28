'use strict';

var utils = require('./utils.js');
var _ = require('lodash');

var slugger = require('uslug');

/**
 * Defines a set of functions usable in all swig templates, are merged into context on render
 * @param  {Object}   swig        Swig engine
 */
module.exports.swigFunctions = function(swig) {

  var self = this;

  this.context = {};
  this.data = {};
  this.settings = {};
  this.typeInfo = {};

  this.paginate = false;
  this.curPage = 1;
  this.maxPage = -1;
  this.pageUrl = 'page-';
  this.paginationBaseUrl = null;
  this.cachedData = {};
  this.CURRENT_URL = '/';

  var url = function(object) {
    var slug = object.slug ? object.slug : (object.name ? slugger(object.name).toLowerCase() : null);
    var prefix = object._type ? object._type : '';

    var url = '';
    if(prefix) {
      url = '/' + prefix + '/' + slug + '/';
    } else {
      url = '/' + slug + '/';
    }

    return url;
  };

  this.setData = function(data) {
    self.cachedData = {};
    self.data = data;
  };

  this.setTypeInfo = function(typeInfo) {
    self.typeInfo = typeInfo;
  };

  this.setSettings = function(settings) {
    self.settings = settings;
  };

  var getTypes = function() {
    var types = [];

    for(var key in self.typeInfo) {
      if(!self.typeInfo[key].oneOff) {
        types.push({ slug: key, name: self.typeInfo[key].name });
      }
    }

    return types;
  };

  var getItem = function(type, key) {
    if(!type) {
      return {};
    }

    if(!key) {
      var parts = type.split(" ", 2);
      if(parts.length !== 2) {
        return {};
      }

      type = parts[0];
      key = parts[1];
    }
    
    if(!self.typeInfo[type]) {
      return {};
    }

    var item = self.data[type][key];

    if(!item) {
      return {};
    }

    item._type = type;
    return item;
  };

  var getCombined = function() {
    var names = [].slice.call(arguments, 0);

    if(self.cachedData[names.join(',')])
    {
      return self.cachedData[names.join(',')];
    }

    // TODO, SLUG NAME THE SAME WAS CMS DOES

    var data = [];
    names.forEach(function(name) {
      var tempData = self.data[name] || {};

      if(self.typeInfo[name] && self.typeInfo[name].oneOff) {
        data = tempData;
        return;
      }

      tempData = _.omit(tempData, function(value, key) { return key.indexOf('_') === 0; });

      // convert it into an array
      tempData = _.map(tempData, function(value, key) { value._id = key; value._type = name; return value });
      tempData = _.filter(tempData, function(item) { 
        if(!item.publish_date) {
          return false;
        }

        var now = Date.now();
        var pdate = Date.parse(item.publish_date);

        if(pdate > now + (1 * 60 * 1000)) {
          return false;
        }

        return true;
      });

      data = data.concat(tempData);
    });

    
    self.cachedData[names.join(',')] = data;

    return data;
  };

  var paginate = function(data, perPage, pageName) {
    if(self.curPage === 1 && self.paginate === true)
    {
      throw new Error('Can only paginate one set of data in a template.');
    }

    var items = utils.slice(data, perPage, perPage * (self.curPage-1));
    self.paginate = true;

    if(self.paginationBaseUrl === null) {
      self.paginationBaseUrl = self.CURRENT_URL;
    }

    self.pageUrl = pageName || self.pageUrl;
    self.maxPage = Math.ceil(_(data).size() / perPage);

    return items;
  };

  var getCurPage = function() {
    return self.curPage;
  };

  var getMaxPage = function() {
    return self.maxPage;
  };

  var getPageUrl = function(pageNum) {
    if(pageNum == 1) {
      return self.paginationBaseUrl;
    }

    return self.paginationBaseUrl + self.pageUrl + pageNum + '/';
  };

  var getCurrentUrl = function() {
    return self.CURRENT_URL;
  };

  var getSetting = function(key) {
    if(!self.settings.general) {
      return null;
    }

    return self.settings.general[key];
  };

  // FUNCTIONS USED FOR PAGINATION HELPING, IGNORE FOR MOST CASES
  this.shouldPaginate = function() {
    return self.curPage <= self.maxPage;
  };

  // Reset initial data
  this.init = function() {
    self.paginate = false;
    self.curPage = 1;
    self.pageUrl = 'page-'
    self.maxPage = -1;
    self.paginationBaseUrl = null;
  };

  this.increasePage = function() {
    self.curPage = self.curPage + 1;
  };
  
  this.setParams = function(params) {
    for(var key in params) {
      self[key] = params[key];
    }
  };

  this.getFunctions = function() {
    return {
      get: getCombined,
      getItem: getItem,
      getTypes: getTypes,
      paginate: paginate,
      getCurPage: getCurPage,
      getMaxPage: getMaxPage,
      getPageUrl: getPageUrl,
      url: url,
      getCurrentUrl: getCurrentUrl,
      getSetting: getSetting,
      cmsVersion: 'v2'
    };
  };


  return this;
};