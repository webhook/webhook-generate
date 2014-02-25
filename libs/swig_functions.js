'use strict';

var utils = require('./utils.js');
var _ = require('lodash');

var slugger = require('slug');

/**
 * Defines a set of functions usable in all swig templates, are merged into context on render
 * @param  {Object}   swig        Swig engine
 */
module.exports.swigFunctions = function(swig) {

  var self = this;

  this.context = {};
  this.data = {};

  this.paginate = false;
  this.curPage = 1;
  this.maxPage = -1;
  this.pageUrl = 'page-';
  this.paginationBaseUrl = null;
  this.cachedData = {};
  this.typeInfo = {};
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

  var getTypes = function() {
    var types = [];

    for(var key in self.typeInfo) {
      if(!self.typeInfo[key].oneOff) {
        types.push({ slug: key, name: self.typeInfo[key].name });
      }
    }

    return types;
  };

  var getCombined = function() {
    var names = [].slice.call(arguments, 0);

    if(self.cachedData[names.join(',')])
    {
      return self.cachedData[names.join(',')];
    }

    var data = {};
    names.forEach(function(name) {
      var tempData = self.data[name] || {};

      if(self.typeInfo[name].oneOff) {
        data = tempData;
        return;
      }

      tempData = _.omit(tempData, function(value, key) { return key.indexOf('_') === 0; });

      if(!self.typeInfo[name].oneOff) {
        _.forIn(tempData, function(value) { value._type = name; });
      }

      data = utils.extend(data, tempData);
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
    return self.paginationBaseUrl + self.pageUrl + pageNum + '/';
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
      getTypes: getTypes,
      paginate: paginate,
      getCurPage: getCurPage,
      getMaxPage: getMaxPage,
      getPageUrl: getPageUrl,
      url: url,
      CURRENT_URL: self.CURRENT_URL,
    };
  };


  return this;
};