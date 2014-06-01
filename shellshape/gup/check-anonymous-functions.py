#!/usr/bin/env python
import os,sys,re
import logging
# logging.basicConfig(level=logging.DEBUG)
logging.basicConfig(level=logging.WARN, format='%(levelname)s: %(msg)s')
log = logging.getLogger()

FUNCTION = re.compile(r'\bfunction\b')
THIS = re.compile(r'\bthis[^;]\b') # this is allowed at end of statements, assume `var x=this;` knows what it's doing
LINE_COMMENT = re.compile(r'//.*')

def extract_anonymous_functions(contents):
	OPENERS = frozenset(('{', '(', '['))
	CLOSERS = {
		'}':'{',
		')':'(',
		']':'[',
	}
	QUOTES = frozenset(('"',"'"))

	for match in re.finditer(FUNCTION, contents):
		cmd = ''
		escape = False
		context = []

		charpos = match.end()
		log.debug("function @ charcter %s" % charpos)
		chunk = ""
		while charpos < len(contents):
			letter = contents[charpos]
			chunk+=letter
		
			open_ctx = context[-1] if context else None
			log.debug("got letter %r, open_ctx = %r, esc=%s" % (letter, open_ctx, escape))

			if not escape:
				# behave differently if inside quotes
				if open_ctx in QUOTES:
					if open_ctx == letter:
						context.pop()
				else:
					# quotes and brackets can nest in anything but quotes
					if letter in QUOTES or letter in OPENERS:
						context.append(letter)
					elif letter in CLOSERS:
						opener = CLOSERS[letter]
						if open_ctx == opener:
							context.pop()

				if not context and letter == '}':
					# see if this looks like an anonymous function argument - i.e
					# is followed by a "," or ")"
					i = charpos
					logging.info("saw function: " + chunk);
					while True:
						i+=1
						if i>=len(contents):
							log.info("reached EOF")
							break
						if str.isspace(contents[i]):
							log.info("skip: %r" % contents[i])
							# skip whitespace
							continue
						else:
							if contents[i] in (')',','):
								yield (charpos, chunk.strip())
							else:
								log.info("not anon: %r" % contents[i])
								# log.info(repr(chunk))
								# log.info(repr(contents[i: i+100]));
								# print chunk
							break

					chunk = ''
					break

			cmd += letter
			charpos += 1

		# if backslash, set `escape` for the next letter we encounter,
		# note that two backslashes in a row reverts to unescaped
		escape = letter == '\\' and not escape

	# yield chunk.strip()


if __name__ == '__main__':
	status = 0
	for filename in sys.argv[1:]:
		with open(filename) as f:
			contents = f.read()
			for start_idx, fun in extract_anonymous_functions(contents):
				fun = re.sub(LINE_COMMENT, '', fun)
				if re.search(THIS, fun):
					newline_count = len(re.findall(r'\n', contents[:start_idx]))
					log.error("`this` in anonymous function at %s:%s:\nfunction%s" %
							(filename, newline_count+1, fun))
					status=1
	sys.exit(status)


