var app = angular.module('hackerNews', ['ui.router']);

app.config(['$stateProvider', '$urlRouterProvider', function ($stateProvider, $urlRouterProvider) {
	$stateProvider
	    .state('home', {
	    	url: '/home',
	    	templateUrl: 'javascripts/home.html',
	    	controller: 'MainCtrl',
	    	resolve: {
	    		postPromise: ['posts', function(posts) {
	    			return posts.getAll();
	    		}]
	    	}
	    })
	    .state('posts', {
	    	url: '/posts/{id}',
	    	templateUrl: 'javascripts/posts.html',
	    	controller: 'PostsCtrl',
	    	resolve: {
	    		post: ['$stateParams', 'posts', function($stateParams, posts) {
	    			return posts.get($stateParams.id);
	    		}]
	    	}
	    })
	    .state('login', {
	    	url: '/login',
	    	templateUrl: 'javascripts/login.html',
	    	controller: 'AuthCtrl',
	    	onEnter: ['$state', 'auth', function($state, auth) {
	    		if (auth.isLoggedIn()) {
	    			$state.go('home');
	    		}
	    	}]
	    })
	    .state('register', {
	    	url: '/register',
	    	templateUrl: 'javascripts/register.html',
	    	controller: 'AuthCtrl',
	    	onEnter: ['$state', 'auth', function($state, auth) {
	    		if (auth.isLoggedIn()) {
	    			$state.go('home');
	    		}
	    	}]
	    });
	$urlRouterProvider.otherwise('home');
}]);

app.factory('auth', ['$http', '$window', function($http, $window) {
	var auth = {};

	auth.saveToken = function (token) {
		$window.localStorage['hacker-news-token'] = token;
	};

	auth.getToken = function () {
		return $window.localStorage['hacker-news-token'];
	};

	auth.isLoggedIn = function () {
		var token = auth.getToken();

		if (token) {
			var payload = JSON.parse($window.atob(token.split('.')[1]));
			return payload.exp > Date.now() / 1000;
		} else {
			return false;
		}
	};

	auth.currentUser = function () {
		if (auth.isLoggedIn()) {
			var token = auth.getToken();
			var payload = JSON.parse($window.atob(token.split('.')[1]));

			return payload.username;
		}
	};

	auth.register = function(user) {
		return $http.post('/register', user).success(function(data) {
			auth.saveToken(data.token);
		});
	};

	auth.login = function (user) {
		return $http.post('/login', user).success(function(data) {
			auth.saveToken(data.token);
		});
	};

	auth.logOut = function (){
		$window.localStorage.removeItem('hacker-news-token');
	};

	return auth;
}]);

app.factory('posts', ['$http', 'auth', function ($http, auth) {
	var o = {
		posts: [],
		comments: []
	};

	o.getAll = function () {
		return $http.get('/posts').success(function(data) {
			angular.copy(data, o.posts);
		});
	};

	o.create = function (post) {
		return $http.post('/posts', post, {
			headers: {Authorization: 'Bearer '+auth.getToken()}
		}).success(function(data) {
			o.posts.push(data);
		});
	};

	o.upvote = function(post) {
		return $http.put('/posts/' + post._id + '/upvote', null, {
			headers: {Authorization: 'Bearer '+auth.getToken()}
		}).success(function(data) {
			post.upvotes += 1;
		});
	};

	o.downvote = function(post) {
		return $http.put('/posts/' + post._id + '/downvote', null, {
			headers: {Authorization: 'Bearer '+auth.getToken()}
		}).success(function(data){
			post.downvotes += 1;
		});
	};

	o.get = function (id) {
		return $http.get('/posts/' + id).then(function(res) {
			return res.data;
		});
	};

	o.AddComment = function (id, comment) {
		return $http.post('/posts/' + id + '/comments', comment, {
			headers: {Authorization: 'Bearer '+auth.getToken()}
		});
	};

	o.upvoteComment = function (post, comment) {
		return $http.put('/posts/' + post._id + '/comments/' + comment._id + '/upvote', null, {
			headers: {Authorization: 'Bearer '+auth.getToken()}
		}).success(function(data) {
		    comment.upvotes += 1;
		});
	};

	o.downvoteComment = function(post, comment) {
		return $http.put('/posts/' + post._id + '/comments/' + comment._id + '/downvote', null, {
			headers: {Authorization: 'Bearer '+auth.getToken()}
		}).success(function(data) {
			comment.downvotes += 1;
		});
	};

	return o;
}]);

app.controller('MainCtrl', ['$scope','posts', 'auth', function ($scope, posts, auth) {
	$scope.header = 'hackerNews';

	$scope.posts = posts.posts;

	$scope.addPost = function () {
		if (!$scope.title || $scope.title === '') {
			return;
		}
		posts.create({
			title: $scope.title,
			link: $scope.link,
		});
		$scope.title = '';
		$scope.link = '';
	};

	$scope.incrementUpvotes = function (post) {
		posts.upvote(post);
	};

	$scope.downVotes = function (post) {
		posts.downvote(post);
	};

	$scope.isLoggedIn = auth.isLoggedIn;
}]);

app.controller('PostsCtrl', ['$scope', 'posts', 'post', 'auth', function ($scope, posts, post, auth) {
	$scope.post = post;

	$scope.incrementUpvotes = function (comment) {
		posts.upvoteComment(post, comment);
	};

	$scope.downvoteComments = function(comment) {
		posts.downvoteComment(post, comment);
	};

	$scope.addComment = function (){
		if (!$scope.body || $scope.body === '') { return; }
		posts.AddComment(post._id, {
			body: $scope.body,
			author: $scope.user,
		}).success(function(comment) {
			$scope.post.comments.push(comment);
		});
		$scope.body = '';
		$scope.author = '';
	};

	$scope.isLoggedIn = auth.isLoggedIn;
}]);

app.controller('AuthCtrl', [
	'$scope',
	'$state',
	'auth',
	function ($scope, $state, auth) {
		$scope.user = {};

		$scope.register = function() {
			auth.register($scope.user).error(function(error) {
				$scope.error = error;
			}).then(function() {
				$state.go('home');
			});
		};

		$scope.logIn = function () {
			auth.login($scope.user).error(function(error) {
				$scope.error = error;
			}).then(function(){
				$state.go('home');
			});
		};

		/*$scope.logOut = function() {
			auth.logOut();
		};*/
}]);

app.controller('NavCtrl', [
	'$scope',
	'auth',
	function ($scope, auth) {
		$scope.isLoggedIn = auth.isLoggedIn;
		$scope.currentUser = auth.currentUser;
		$scope.logOut = auth.logOut;
	}
]);