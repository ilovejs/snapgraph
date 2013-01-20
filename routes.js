var nodeio = require('node.io');
var db = require('./db.js');

exports.getUser = function(name, res, fun){
    var runner = new nodeio.Job({
        input: false,
        run: function () {
            this.getHtml('http://www.snapchat.com/' + name, function(err, $) {
                //Handle any request / parsing errors
                if (err) this.exit(err);

                //Hard dependency but only reather other way is to see if the title contains 404
                if($('title').text == "Oops! 404"){
                    res.send({error: "No user found!"});
                    return;
                }

                var user, score, names = [], scores = [];

                    user = $('div#name a span#name_text').text;

                    //regex here removes all num digit chars
                    score = $('div#score').text.replace(/[^\d.]/g, "");

                    var pairs = [];

                    try{
                        $('div.best_name a').each(function(a) {
                            names.push(a.text);
                        });

                        $('div.best_score').each(function(a) {
                            scores.push(a.text);
                        });

                        for(var i = 0; i < names.length; i++){
                            pairs.push({name: names[i], score: parseInt(scores[i])});
                        }
                    }
                    catch(error){
                        try{
                            //1 friend case, refactor (submit pull request to nodeio, this is pretty bad)
                            names.push($('div.best_name a').text);
                            scores.push($('div.best_score').text);
                            pairs.push({name: names[0], score: parseInt(scores[0])});
                        }
                        catch(innerError){
                            //Really no friends
                            console.log("No friends have been found.");
                        }
                    }
                    
                    var obj = {};

                    obj._id = user;
                    obj.score = parseInt(score);
                    obj.children = pairs;

                    db.addUser(obj, function(){
                            if(res){
                                res.send(obj);
                            }
                            if(fun){
                                fun(obj);
                            }
                        }
                    );
                }
            );
        }
    });

    if(fun){
        nodeio.start(runner, {timeout: 100});
    }
    else{
       db.getUser(name, function(user){
           if(user){
               console.log("Using db hit");

               //Check time difference
               if(hoursBetween(new Date(user.t), new Date()) > 20){
                    console.log("Stale data, updating");
                    nodeio.start(runner, {timeout: 100});
               }else{
                res.send(user);
               }
           }
           else{
               console.log("Using scrape hit");
               nodeio.start(runner, {timeout: 100});
           }
       });
}

};

exports.refreshGraph = function(user, res, maxDepth, curDepth){
    console.log("Current depth is " + curDepth);
    var curUser = exports.getUser(user, res, function(out){
        
        console.log("Current user: " + JSON.stringify(out));

        if(curDepth < maxDepth){
            for(var j = 0; j < out.children.length; j++){
                exports.refreshGraph(out.children[j].name, res, maxDepth, curDepth + 1);
            }
        }
    });

    res.send({"status":"Update in progress"});
};

var hoursBetween = function(d1, d2){
    var hour = 3600000;

    var difference_ms = Math.abs(d1.getTime() - d1.getTime());
    return Math.round(difference_ms/hour);
};
