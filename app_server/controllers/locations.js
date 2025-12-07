//app_server/controllers/location.js
var request = require('request');

const apiOptions = {
  server: 'http://localhost:3000'
};
if(process.env.NODE_ENV === 'production'){
  apiOptions.server = 'https://loc8r-api24-3liz.onrender.com';
}

const homelist = (req, res) => {
  const path = '/api/locations';
  const requestOptions = {
    url: `${apiOptions.server}${path}`,
    method: 'GET',
    json:{},  
    qs:{
      lng: 126.9634,
      lat: 37.4789,
      maxDistance: 2000000
    }
  };
  request(
    requestOptions,
    (err, response, body) => { // 👈 {statusCode} 대신 response 전체를 받도록 수정
      let data = [];
      
      // 1. 네트워크 오류 처리 (TypeError 방지)
      if (err) {
        console.error("API 호출 네트워크 오류:", err.message);
        renderHomepage(req, res, { message: "API 서버에 연결할 수 없습니다." });
        return;
      }
      
      // 2. response 유효성 확인 및 statusCode 사용
      if (response) {
        if (response.statusCode === 200 && body.length) {
          data = body.map( (item) => {
            item.distance = formatDistance(item.distance);
            return item;
          });
        };
      } else {
        // response 객체가 없는 경우
        renderHomepage(req, res, { message: "API 응답을 받지 못했습니다." });
        return;
      }
      
      renderHomepage(req, res, data);
    }
  );
};

const formatDistance = (distance) => {
  let thisDistance = 0;
  let unit = 'm';
  if (distance > 1000) {
    thisDistance = parseFloat(distance / 1000).toFixed(1);
    unit = 'km';
  } else {
    thisDistance = Math.floor(distance);
  }
  return thisDistance + unit;
};

const renderHomepage = (req, res, responseBody) => {
  let message = null;
  if (!(responseBody instanceof Array)) {
    // API 호출 오류가 발생했을 때 message 객체가 들어올 수 있음
    if (responseBody && responseBody.message) {
      message = responseBody.message;
    } else {
      message = "API lookup error";
    }
    responseBody = [];
  } else {
    if (!responseBody.length) {
      message = "No places found nearby";
    }
  }
  res.render('locations-list', {
    title: 'Loc8r - find a place to work with wifi',
    pageHeader: {
      title: 'Loc8r',
      strapline: 'Find places to work with wifi near you!'
    },
    sidebar: "Looking for wifi and a seat? Loc8r helps you find places \
      to work when out and about. Perhaps with coffee, cake or a pint? \
      Let Loc8r help you find the place you're looking for.",
    locations: responseBody,
    message
  });
};

const renderDetailPage = function (req, res, location) {
  res.render('location-info', {
    title: location.name,
    pageHeader: {
      title: location.name
      },
    sidebar: {
      context: 'is on Loc8r because it has accessible wifi and \
        space to sit down with your laptop and get some work done.',
      callToAction: "If you've been and you like it - or if you \
        don't - please leave a review to help other people just like you."
    },
    location
  });
};

const showError = (req, res, status) => {
  let title = '';
  let content = '';
  if (status === 404) {
    title = '404, page not found';
    content = 'Oh dear. Looks like you can\'t find this page. Sorry.';
  } else{
    title = `${status}, something's gone wrong`;
    content = 'Something, somewhere, has gone just a little bit wrong.';
  }
  res.status(status);
  res.render('generic-text', {
    title,
    content
  });
};

const renderReviewForm = function (req, res, {name}) {
  res.render('location-review-form', {
    title: `Review ${name} on Loc8r`,
    pageHeader: { title: `Review ${name}` },
    error: req.query.err
  });
};

const getLocationInfo = (req, res, callback) => {
  const path = `/api/locations/${req.params.locationid}`;
  const requestOptions = {
    url : `${apiOptions.server}${path}`,
    method : 'GET',
    json : {}
  };
  request(
    requestOptions,
    (err, response, body) => { // 👈 {statusCode} 대신 response 전체를 받도록 수정
      
      // 1. 네트워크 오류 처리
      if (err) {
        console.error("API 호출 네트워크 오류:", err.message);
        showError(req, res, 503); // Service Unavailable
        return;
      }
      
      // 2. response 유효성 확인 및 statusCode 사용
      if (response) {
        let data = body;
        if (response.statusCode === 200) {
          data.coords = {
            lng : body.coords[0],
            lat : body.coords[1]
          };
          callback(req, res, data);
        } else {
          showError(req, res, response.statusCode);
        }
      } else {
         // response 객체가 없는 경우
         showError(req, res, 500);
      }
    }
  );
};

const locationInfo = (req, res) => {
  getLocationInfo(req, res,
    (req, res, responseData) => renderDetailPage(req, res, responseData)
  );
};

/* GET 'Add review' page */
const addReview = (req, res) => {
  getLocationInfo(req, res,
    (req, res, responseData) => renderReviewForm(req, res, responseData)
  );
};

const doAddReview = (req, res) => {
  const locationid = req.params.locationid;
  const path = `/api/locations/${locationid}/reviews`;
  const postdata = {
    author: req.body.name,
    rating: parseInt(req.body.rating, 10),
    reviewText: req.body.review
  };
  const requestOptions = {
    url: `${apiOptions.server}${path}`,
    method: 'POST',
    json: postdata
  };
  if (!postdata.author || !postdata.rating || !postdata.reviewText) {
    res.redirect(`/location/${locationid}/review/new?err=val`);
  } else {
    request(
      requestOptions,
      (err, response, body) => { // 👈 {statusCode}와 {name} 대신 response와 body 전체를 받도록 수정
        
        // 1. 네트워크 오류 처리
        if (err) {
          console.error("API 호출 네트워크 오류:", err.message);
          showError(req, res, 503); 
          return;
        }

        // 2. response 유효성 확인 및 statusCode 사용
        if (response) {
            if (response.statusCode === 201) {
              res.redirect(`/location/${locationid}`);
            } else if (response.statusCode === 400 && body && body.name === 'ValidationError') {
              res.redirect(`/location/${locationid}/review/new?err=val`);
            } else {
              showError(req, res, response.statusCode);
            }
        } else {
           showError(req, res, 500);
        }
      }
    );
  }
};

module.exports = {
  homelist,
  locationInfo,
  addReview,
  doAddReview
};