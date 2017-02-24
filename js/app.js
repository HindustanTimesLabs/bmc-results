require("../css/styles.scss")
var width = $("#map").width(), height = $("#map").height();

var projection = d3.geoMercator();

var cc = {
  "red": "#fc8d62",
  "orange": "#fdb462",
  "yellow": "#ffd92f",
  "green": "#66c2a5",
  "blue": "#80b1d3",
  "violet": "#e78ac3",
  "grey": "#ccc"
}

var colors = {
  "Shiv Sena" : cc.red,
  "Bharatiya Janata Party" : cc.orange,
  "Indian National Congress" :cc.blue,
  "Nationalist Congress Party" : cc.green
};

var path = d3.geoPath()
    .projection(projection)
    .pointRadius(2);

var svg = d3.select("#map").append("svg")
    .attr("width", width)
    .attr("height", height);

var g = svg.append("g");

d3.queue()
    .defer(d3.json, "data/geodata.json")
    .defer(d3.csv, "data/data.csv")
    .await(ready);

function ready(error, geo, data){
  var boundary = centerZoom(geo);
  drawSubUnits(geo);
  drawOuterBoundary(geo, boundary);

  f = data;
  colorSubUnits(f);
  drawLegend(f);
  drawTip(f);
  zoom();
}

// This function "centers" and "zooms" a map by setting its projection's scale and translate according to its outer boundary
// It also returns the boundary itself in case you want to draw it to the map
function centerZoom(data){

  var o = topojson.mesh(data, data.objects.outline, function(a, b) { return a === b; });

  projection
      .scale(1)
      .translate([0, 0]);

  var b = path.bounds(o),
      s = 1 / Math.max((b[1][0] - b[0][0]) / width, (b[1][1] - b[0][1]) / height),
      t = [(width - s * (b[1][0] + b[0][0])) / 2, (height - s * (b[1][1] + b[0][1])) / 2];

  projection
      .scale(s)
      .translate(t);

  return o;
}

function drawOuterBoundary(data, boundary){
  g.append("path")
      .datum(boundary)
      .attr("d", path)
      .attr("class", "subunit-boundary");
}

function drawSubUnits(data){
  g.selectAll(".subunit")
      .data(topojson.feature(data, data.objects.mumbai).features)
    .enter().append("path")
      .attr("class", function(d){ return "subunit ac-" + d.properties.id })
      .attr("d", path);
}

function colorSubUnits(data){

  g.selectAll(".subunit")
      .style("fill", getFill);

  function getFill(d){
    if (d.properties.id != 0){
      var w = _.where(data, {id: d.properties.id})[0].party;
    }
    return Object.keys(colors).indexOf(w) == -1 ? cc.grey : colors[w];
  }

}

function drawLegend(data){
  var l = data.length;

  var keys = Object.keys(colors);
  var arr = [];
  keys.forEach(function(d, i){
    var wl = _.where(data, {party: d}).length;
    arr.push(wl);
    makeItem(i, colors[d], d, wl);
  });

  var s = arr.reduce(function(a,b){return a + b}, 0);
  if (s - l != 0){
    makeItem(keys.length, cc.grey, "Other", l - s);
  }

  function makeItem(i, bg, name, seats){
    $("#legend").append("<div class='legend-item legend-item-" + i + "'></div>");
    $(".legend-item-" + i).append("<div class='party'></div>");
    $(".legend-item-" + i + " .party").append("<div class='swatch' style='background:" + bg + "'></div>");
    $(".legend-item-" + i + " .party").append("<div class='result-container'></div>");
    $(".legend-item-" + i +" .result-container").append("<div class='name'>" + name + "</div>");
    $(".legend-item-" + i +" .result-container").append("<div class='result'></div>");
    $(".legend-item-" + i + " .result-container .result").append("<div class>" + seats + " seats (" + Math.round((seats / l * 100) * 10) / 10 + "%)</div>");
  }
}

function drawTip(data){

  $("body").append("<div class='tip'></div>");
  $(".tip").hide();

  g.selectAll(".subunit")
    .on("mouseover", tipShow)
    .on("mouseout", tipHide);

  $(".subunit").mousemove(tipMove); // do this with jQuery because the d3 version gets messed up when you zoom

  function tipShow(d){

    d3.select(this).moveToFront();
    d3.selectAll(".place-label").moveToFront();

    var ac = d.properties.id;
    $(".tip").show();
    $(".subunit").removeClass("highlight");
    $(".ac-" + ac).addClass("highlight");
    var w = _.where(data, {id: ac.toString()})[0];
    var c = Object.keys(colors).indexOf(w.party);

    $(".tip").append("<div class='name'>Ward No. " + w.id +"</div>");
    $(".tip").append("<table></table>");
    $(".tip table").append("<tr class='party'></tr>");
    $(".tip table .party").append("<td>Party</td>");
    $(".tip table .party").append("<td><div class='swatch' style='background:" + (c == -1 ? cc.grey : colors[w.party]) + "'></div><div class='party-name'>" + toTitleCase(w.party) + "</div></td>");
    $(".tip table").append("<tr class='candidate'></tr>");
    $(".tip table .candidate").append("<td>Candidate</td>");
    $(".tip table .candidate").append("<td>" + toTitleCase(w.name) + "</td>");

  }

  function tipMove(e){

    // calculate top
    var y = e.pageY;
    var h = $(".tip").height();
    var o = $("#map").offset().top;
    var t = y - h - 20;

    // calculate left
    var x = e.pageX;
    var w = $(".tip").width();
    var m = $("#map").width() + $("#map").offset().left;
    var l = x - w / 2;

    $(".tip").css({
      top: t < o ? y + 10 : t,
      left: l < 10 ? 10 : l + w + 10 > m ? m - w - 10 : l
    });

  }

  function tipHide(d){

    d3.selectAll(".subunit").moveToBack();
    $(".subunit").removeClass("highlight");
    $(".tip").empty().hide();

  }
}



var centered,
  z = 1;

function zoom(){

  $("#map").append("<div class='control zoom'>Zoom out</div>");

  $(".control.zoom").css("top", $("#map").offset().top + 45).addClass("inactive");

  g.selectAll(".subunit")
      .on("click", clicked);

}

// function search(data){

//   var arr = [];
//   data.forEach(function(d){
//     arr.push("Ward No. "+d.id);
//   });

//   $("#map").append("<input class='control search' placeholder='Search by constituency'></input>");
//   $(".control.search").css({
//     "right": 50 + $(".control.zoom").width(),
//     "top": $("#map").offset().top + 45
//   }).autocomplete({
//     source: arr
//   }).keyup(function(e){
//     if (e.which == 13){
//       searchZoom();
//     }
//   });

//   $(document).on("click", ".ui-menu-item", function(){
//     searchZoom();
//   });


//   function searchZoom(){

//     var val = $(".control.search").val();
//     var whr = _.where(data, {ac_name: val});
//     var ac = whr != "" ? whr[0].ac_no : null;

//     if (ac){
//       var p = d3.select(".ac-" + ac).moveToFront();
//       $(".subunit").removeClass("highlight");
//       $(".ac-" + ac).addClass("highlight");
//       var center = getBoundingBoxCenter(p);
//       x = center[0];
//       y = center[1];
//       z = 3;
//       $(".control.zoom").removeClass("inactive").addClass("active");
//       d3.select(".control.zoom")
//           .on("click", clicked);
//       $('.zoom.out').removeClass('inactive');

//       g.transition()
//         .duration(750)
//         .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")scale(" + z + ")translate(" + -x + "," + -y + ")")
//         .style("stroke-width", 1 / z + "px");
//     }
//   }

// }

// UTILITY FUNCTIONS:
// Can be used in multiple function scalled from ready()

function getBoundingBoxCenter(selection) {
    // get the DOM element from a D3 selection
    // you could also use "this" inside .each()
    var element = selection.node(),
    // use the native SVG interface to get the bounding box
    bbox = element.getBBox();
    // return the center of the bounding box
    return [bbox.x + bbox.width/2, bbox.y + bbox.height/2];
}

// function to execute when a constituency is clicked (which zooms it in and out)
function clicked(d){

  var x, y;
  var boundary = d3.select('.subunit-boundary');
  var center = getBoundingBoxCenter(boundary);

  if (d && centered !== d) {
    var centroid = path.centroid(d);
    x = centroid[0];
    y = centroid[1];
    z = 3;
    centered = d;
    $('.zoom.out').removeClass('inactive');
  } else {
    x = center[0];
    y = center[1];
    z = 1;
    centered = null;
    $('.zoom.out').addClass('inactive');
  }

  g.selectAll("path")
     .classed("active", centered && function(d) { return d === centered; });

  g.transition()
     .duration(750)
     .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")scale(" + z + ")translate(" + -x + "," + -y + ")")
     .style("stroke-width", 1 / z + "px");

  $(".control.zoom").addClass(z == 1 ? "inactive" : "active").removeClass(z == 1 ? "active" : "inactive");
  if (z != 1){
    d3.select(".control.zoom")
        .on("click", clicked);
  }

}

function toTitleCase(str)
{
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}