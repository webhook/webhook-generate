
/*
Tipue Search 4.0
Copyright (c) 2014 Tipue
Tipue Search is released under the MIT License
http://www.tipue.com/search
*/ 


(function($) {

     $.fn.tipuesearch = function(options) {

          var set = $.extend( {
          
               'show'                   : 7,
               'newWindow'              : false,
               'showURL'                : true,
               'minimumLength'          : 3,
               'descriptiveWords'       : 25,
               'highlightTerms'         : true,
               'highlightEveryTerm'     : false,
               'mode'                   : 'static',
               'liveDescription'        : '*',
               'liveContent'            : '*',
               'contentLocation'        : 'tipuesearch/tipuesearch_content.json'
          
          }, options);
          
          return this.each(function() {

               var tipuesearch_in = {
                    pages: []
               };
               $.ajaxSetup({
                    async: false
               });

               if (set.mode == 'live')
               {
                    for (var i = 0; i < tipuesearch_pages.length; i++)
                    {
                         $.get(tipuesearch_pages[i], '',
                              function (html)
                              {
                                   var cont = $(set.liveContent, html).text();
                                   cont = cont.replace(/\s+/g, ' ');
                                   var desc = $(set.liveDescription, html).text();
                                   desc = desc.replace(/\s+/g, ' ');
                                                                      
                                   var t_1 = html.toLowerCase().indexOf('<title>');
                                   var t_2 = html.toLowerCase().indexOf('</title>', t_1 + 7);
                                   if (t_1 != -1 && t_2 != -1)
                                   {
                                        var tit = html.slice(t_1 + 7, t_2);
                                   }
                                   else
                                   {
                                        var tit = 'No title';
                                   }

                                   tipuesearch_in.pages.push({
                                        "title": tit,
                                        "text": desc,
                                        "tags": cont,
                                        "loc": tipuesearch_pages[i] 
                                   });    
                              }
                         );
                    }
               }
               
               if (set.mode == 'json')
               {
                    console.log('getting json');
                    $.getJSON(set.contentLocation,
                         function(json)
                         {
                              console.log(json);
                              tipuesearch_in = $.extend({}, json);
                         }
                    );
               }

               if (set.mode == 'static')
               {
                    tipuesearch_in = $.extend({}, tipuesearch);
               }                              
               
               var tipue_search_w = '';
               if (set.newWindow)
               {
                    tipue_search_w = ' target="_blank"';      
               }

               function getURLP(name)
               {
                    return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search)||[,""])[1].replace(/\+/g, '%20')) || null;
               }
               if (getURLP('q'))
               {
                    $('#tipue_search_input').val(getURLP('q'));
                    getTipueSearch(0, true);
               }               
               
               $(this).keyup(function(event)
               {
                    if(event.keyCode == '13')
                    {
                         getTipueSearch(0, true);
                    }
               });

               function getTipueSearch(start, replace)
               {
                    $('#tipue_search_content').hide();
                    var out = '';
                    var results = '';
                    var show_replace = false;
                    var show_stop = false;
                    var standard = true;
                    var c = 0;
                    found = new Array();
                    
                    var d = $('#tipue_search_input').val().toLowerCase();
                    d = $.trim(d);
                    
                    if ((d.match("^\"") && d.match("\"$")) || (d.match("^'") && d.match("'$")))
                    {
                         standard = false;
                    }
                    
                    if (standard)
                    {
                         var d_w = d.split(' ');
                         d = '';
                         for (var i = 0; i < d_w.length; i++)
                         {
                              var a_w = true;
                              for (var f = 0; f < tipuesearch_stop_words.length; f++)
                              {
                                   if (d_w[i] == tipuesearch_stop_words[f])
                                   {
                                        a_w = false;
                                        show_stop = true;          
                                   }
                              }
                              if (a_w)
                              {
                                   d = d + ' ' + d_w[i];
                              }
                         }
                         d = $.trim(d);
                         d_w = d.split(' ');
                    }
                    else
                    {
                         d = d.substring(1, d.length - 1);
                    }
               
                    if (d.length >= set.minimumLength)
                    {
                         if (standard)
                         {
                              if (replace)
                              {
                                   var d_r = d;
                                   for (var i = 0; i < d_w.length; i++)
                                   {
                                        for (var f = 0; f < tipuesearch_replace.words.length; f++)
                                        {
                                             if (d_w[i] == tipuesearch_replace.words[f].word)
                                             {
                                                  d = d.replace(d_w[i], tipuesearch_replace.words[f].replace_with);
                                                  show_replace = true;
                                             }
                                        }
                                   }
                                   d_w = d.split(' ');
                              }                   
                    
                              var d_t = d;
                              for (var i = 0; i < d_w.length; i++)
                              {
                                   for (var f = 0; f < tipuesearch_stem.words.length; f++)
                                   {
                                        if (d_w[i] == tipuesearch_stem.words[f].word)
                                        {
                                             d_t = d_t + ' ' + tipuesearch_stem.words[f].stem;
                                        }
                                   }
                              }
                              d_w = d_t.split(' ');

                              for (var i = 0; i < tipuesearch_in.pages.length; i++)
                              {
                                   var score = 1000000000;
                                   var s_t = tipuesearch_in.pages[i].text;

                                   var title = tipuesearch_in.pages[i].title;

                                   for (var f = 0; f < d_w.length; f++)
                                   {
                                        var pat = new RegExp(d_w[f], 'i');
                                        if (tipuesearch_in.pages[i].title.search(pat) != -1)
                                        {
                                             score -= (200000 - i);
                                        }
                                        if (tipuesearch_in.pages[i].text.search(pat) != -1)
                                        {
                                             score -= (150000 - i);
                                        }
                                        
                                        var matches = null;
                                        if (set.highlightTerms)
                                        {
                                             var globalPatr =  new RegExp('(' + d_w[f] + ')', 'gi');

                                             if (set.highlightEveryTerm) 
                                             {
                                                  var patr = new RegExp('(' + d_w[f] + ')', 'gi');
                                             }
                                             else
                                             {
                                                  var patr = new RegExp('(' + d_w[f] + ')', 'i');
                                             }
                                             matches = (s_t.match(globalPatr) || []).length;
                                             matches += (title.match(globalPatr) || []).length;

                                             title = title.replace(globalPatr, "<span class=\"wh-search-term\">$1</span>");
                                             s_t = s_t.replace(patr, "<span class=\"wh-search-term\">$1</span>");
                                        }
                                        if (tipuesearch_in.pages[i].tags.search(pat) != -1)
                                        {
                                             score -= (100000 - i);
                                        }
                                        
                                        if (d_w[f].match("^-"))
                                        {
                                             pat = new RegExp(d_w[f].substring(1), 'i');
                                             if (tipuesearch_in.pages[i].title.search(pat) != -1 || tipuesearch_in.pages[i].text.search(pat) != -1 || tipuesearch_in.pages[i].tags.search(pat) != -1)
                                             {
                                                  score = 1000000000;     
                                             }    
                                        }
                                   }
                                   
                                   if (score < 1000000000)
                                   {
                                        found[c++] = score + '^' + title + '^' + s_t + '^' + tipuesearch_in.pages[i].loc + (matches === null ? '' : ('^' + matches));  
                                   }
                              }
                         }
                         else
                         {
                              var title = tipuesearch_in.pages[i].title;

                              for (var i = 0; i < tipuesearch_in.pages.length; i++)
                              {
                                   var score = 1000000000;
                                   var s_t = tipuesearch_in.pages[i].text;
                                   var pat = new RegExp(d, 'i');
                                   if (tipuesearch_in.pages[i].title.search(pat) != -1)
                                   {
                                        score -= (200000 - i);
                                   }
                                   if (tipuesearch_in.pages[i].text.search(pat) != -1)
                                   {
                                        score -= (150000 - i);
                                   }
                                   
                                   var matches = null;
                                   if (set.highlightTerms)
                                   {
                                        var globalPatr =  new RegExp('(' + d + ')', 'gi');
                                        if (set.highlightEveryTerm) 
                                        {
                                             var patr = new RegExp('(' + d + ')', 'gi');
                                        }
                                        else
                                        {
                                             var patr = new RegExp('(' + d + ')', 'i');
                                        }

                                        matches = (s_t.match(globalPatr) || []).length;
                                        matches += (title.match(globalPatr) || []).length;

                                        title = title.replace(globalPatr, "<span class=\"wh-search-term\">$1</span>");
                                        s_t = s_t.replace(patr, "<span class=\"wh-search-term\">$1</span>");
                                   }
                                   if (tipuesearch_in.pages[i].tags.search(pat) != -1)
                                   {
                                        score -= (100000 - i);
                                   }
                              
                                   if (score < 1000000000)
                                   {
                                        found[c++] = score + '^' + title + '^' + s_t + '^' + tipuesearch_in.pages[i].loc + (matches === null ? '' : ('^' + matches));                                                                   
                                   }                              
                              }
                         }                         
                         
                         if (c != 0)
                         {
                              out += '<dl class="wh-search-results">';

                              out += '<dt>';

                              if (c == 1)
                              {
                                   out += '<span class="wh-search-results-total">1 result for <span class="wh-search-term">' + d + '</span>.</span>';
                              }
                              else
                              {
                                   c_c = c.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                                   out += '<span class="wh-search-results-total">' + c_c + ' results for <span class="wh-search-term">' + d + '</span>.</span>';
                              }

                              if (show_replace == 1)
                              {
                                   out += '<span class="wh-search-instead">Search instead for <a href="javascript:void(0)" id="tipue_search_replaced">' + d_r + '?</span>';
                              }

                              out += '</dt>'
                              
                              found.sort();
                              var l_o = 0;
                              for (var i = 0; i < found.length; i++)
                              {
                                   var fo = found[i].split('^');
                                   var dontElipse = false;
                                   if (l_o >= start && l_o < set.show + start)
                                   {                  
                                        out += '<dd>'
                                        out += '<a href="' + fo[3] + '"' + tipue_search_w + '>';

                                        out += '<h2>' + fo[1] + '</h2>';
 
                                        if (set.showURL)
                                        {  
                                             out += '<p class="wh-search-url">' + fo[3] + ' <span class="wh-search-term-in-page">(' + fo[4] + ' ' + (fo[4] === 1 ? 'appearance' : 'appearances') + ')</span></p>';
                                        }
                
                                        var t = fo[2];
                                        var t_d = '';
                                        var t_w = t.split(' ');
                                        if (t_w.length < set.descriptiveWords)
                                        {
                                             t_d = t;
                                        }
                                        else
                                        {
                                             var firstHighlightIndex = 0;

                                             for (var j = 0; j < t_w.length; j++) {
                                                  var word = t_w[j];
                                                  if(word.indexOf('class="wh-search-term">') !== -1) {
                                                       firstHighlightIndex = j - 1;
                                                       break;
                                                  }
                                             }

                                             firstHighlightIndex = firstHighlightIndex - (set.descriptiveWords/2);

                                             firstHighlightIndex = Math.floor(firstHighlightIndex);

                                             if(firstHighlightIndex < 0) {
                                                  firstHighlightIndex = 0;
                                             }

                                             if(firstHighlightIndex !== 0) {
                                                  t_d += '&hellip;';
                                             }

                                             for (var f = firstHighlightIndex; f < firstHighlightIndex + set.descriptiveWords; f++)
                                             {
                                                  if(f < t_w.length) {
                                                       t_d += t_w[f] + ' '; 
                                                  } else {
                                                       dontElipse = true;
                                                  }
                                             }
                                        }
                                        t_d = $.trim(t_d);
                                        if (t_d.charAt(t_d.length - 1) != '.')
                                        {
                                             if(!dontElipse)
                                                  t_d += '&hellip;';
                                        }
                                        out += '<p class="wh-search-body">' + t_d + '</p>'
                                        out += '</a>';
                                        out += '</dd>';
                                   }
                                   l_o++;     
                              }
                              
                              out += '</dl>';
                              if (c > set.show)
                              {
                                   var pages = Math.ceil(c / set.show);
                                   var page = (start / set.show);
                                   out += '<ul class="wh-search-paginate">';
                                   
                                   if (start > 0)
                                   {
                                       out += '<li><a href="javascript:void(0)" class="tipue_search_foot_box" id="' + (start - set.show) + '_' + replace + '">Prev</a></li>'; 
                                   }
                                                       
                                   if (page <= 2)
                                   {
                                        var p_b = pages;
                                        if (pages > 3)
                                        {
                                             p_b = 3;
                                        }                    
                                        for (var f = 0; f < p_b; f++)
                                        {
                                             if (f == page)
                                             {
                                                  out += '<li class="active">' + (f + 1) + '</li>';
                                             }
                                             else
                                             {
                                                  out += '<li><a href="javascript:void(0)" class="tipue_search_foot_box" id="' + (f * set.show) + '_' + replace + '">' + (f + 1) + '</a></li>';
                                             }
                                        }
                                   }
                                   else
                                   {
                                        var p_b = page + 2;
                                        if (p_b > pages)
                                        {
                                             p_b = pages; 
                                        }
                                        for (var f = page - 1; f < p_b; f++)
                                        {
                                             if (f == page)
                                             {
                                                  out += '<li class="current">' + (f + 1) + '</li>';
                                             }
                                             else
                                             {
                                                  out += '<li><a href="javascript:void(0)" class="tipue_search_foot_box" id="' + (f * set.show) + '_' + replace + '">' + (f + 1) + '</a></li>';
                                             }
                                        }
                                   }                         
                                                      
                                   if (page + 1 != pages)
                                   {
                                       out += '<li><a href="javascript:void(0)" class="tipue_search_foot_box" id="' + (start + set.show) + '_' + replace + '">Next</a></li>'; 
                                   }                    
                                   
                                   out += '</ul>';
                              }                        
                         }
                         else
                         {
                              out += '<span class="wh-search-results-total">Nothing found</span>'; 
                         }
                    }
                    else
                    {
                         if (show_stop)
                         {
                              out += '<span class="wh-search-error">Nothing found. Common words are largely ignored</span>';     
                         }
                         else
                         {
                              out += '<span class="wh-search-error">Search too short</span>';
                              if (set.minimumLength == 1)
                              {
                                   out += '<span class="wh-search-error">Should be one character or more</span>';
                              }
                              else
                              {
                                   out += '<span class="wh-search-error">Should be ' + set.minimumLength + ' characters or more</span>';
                              }
                         }
                    }
               
                    $('#tipue_search_content').html(out);
                    $('#tipue_search_content').slideDown(200);
                    
                    $('#tipue_search_replaced').click(function()
                    {
                         getTipueSearch(0, false);
                    });                
               
                    $('.tipue_search_foot_box').click(function()
                    {
                         var id_v = $(this).attr('id');
                         var id_a = id_v.split('_');
                    
                         getTipueSearch(parseInt(id_a[0]), id_a[1]);
                    });                                                       
               }          
          
          });
     };
   
})(jQuery);