import csv
import json
import fileinput


'''
transform survey data from json format to csv (delimiter is tab)
'''


csvfile = open('tmp_file/survey.csv', 'w', newline='')
csvwriter = csv.writer(csvfile, delimiter='\t')

surveys = ''
for line in fileinput.input():
    surveys += line
surveys = json.loads(surveys)

for index, survey in enumerate(surveys):
    if index == 0:
        header = ['user id', 'channel id']
        header.extend(['pre survey ('+item['name']+')' if 'name' in item.keys() else ' ' for item in survey['pre_survey']])
        header.extend(['post survey ('+item['name']+')' if 'name' in item.keys() else ' ' for item in survey['post_survey']])
        csvwriter.writerow(header)
    else:
        row = [survey['user'] if 'user' in survey.keys() else ' ',
               survey['channel'] if 'channel' in survey.keys() else ' ']
        if survey['pre_survey']:
            row.extend([item['answer'] if 'answer' in item.keys() else ' ' for item in survey['pre_survey']])
        if survey['post_survey']:
            row.extend([item['answer'] if 'answer' in item.keys() else ' ' for item in survey['post_survey']])
        csvwriter.writerow(row)


csvfile.close()
print('Done.\n')
