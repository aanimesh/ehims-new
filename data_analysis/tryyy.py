import fileinput
import json


file = open('try.txt', 'w')
group = ''
for line in fileinput.input():
	group += line
#group = json.loads(group)
file.write(group)
#print(len(group['messages'].keys()))
print('ok')
