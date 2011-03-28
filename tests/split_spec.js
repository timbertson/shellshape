(function() {
  var eq, split;
  split = require('split');
  eq = function(a, b) {
    if (a !== b) {
      throw "expected " + b + ", got " + a;
    }
  };
  describe('MultiSplit', function() {
    return it('should divide an array', function() {
      return eq(split.divideAfter(2, [1, 2, 3, 4, 5]), [[1, 2], [3, 4, 5]]);
    });
  });
}).call(this);
