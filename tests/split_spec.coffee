#require("sys").puts("??")
eq = require("assert").eq
split = require('../split')
eq = (a,b) ->
	if a != b
		throw("expected #{b}, got #{a}")

describe 'MultiSplit', ->
	it 'should divide an array', ->
		eq(split.divideAfter(2, [1,2,3,4,5]), [[1,2], [3,4,5]])

