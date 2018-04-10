require("../common/nice_console_log.js");
var config = require("../common/config.js");
var fs = require('fs');

var options = {
  key: fs.readFileSync(config.permfolder + '/privkey.pem'),
  cert: fs.readFileSync(config.permfolder + '/cert.pem'),
  ca: fs.readFileSync(config.permfolder + '/chain.pem')
};

var https = require("https");
var urlParser = require("url");
var getIp = require('external-ip')();
var JOIN_CODE = config.service.loadbalancer.password.join;
var statuscode = config.service.loadbalancer.password.status;
var room_regex = /^[a-z0-9_]+$/i;

var Servers = require("./scripts/Servers.js");
var servers = new Servers(JOIN_CODE);

// This is the amount of people the autobalancer uses
// for the first joined room
var MAX_USERS_PER_ROOM = 25;

// How many people are allowed to really join when they ask for a specific room
var MAX_USERS_PER_ROOM_IF_SPECIFIC = 30;

// Tor ip adresses
var torIps = ["103.10.197.50","103.236.201.110","103.240.91.7","103.56.207.84","104.156.240.161","104.156.240.172","104.157.152.118","104.167.102.244","104.167.107.142","104.167.113.138","104.167.99.191","104.177.150.66","104.192.0.18","104.208.241.245","104.208.247.43","104.232.3.33","104.233.103.132","104.233.124.244","104.233.83.206","104.233.92.73","104.237.152.195","104.245.233.128","104.40.219.63","105.101.102.59","106.186.117.83","106.186.28.33","106.187.99.148","107.131.237.203","107.170.228.105","107.181.174.84","107.181.178.204","107.182.131.117","108.166.168.158","108.61.123.86","108.61.212.102","108.61.228.12","109.108.218.232","109.111.160.8","109.120.173.48","109.132.63.218","109.162.49.250","109.163.234.2","109.163.234.4","109.163.234.5","109.163.234.7","109.163.234.8","109.163.234.9","109.169.0.29","109.169.23.202","109.169.33.163","109.190.200.97","109.200.130.62","109.201.133.100","109.201.152.228","109.201.152.238","109.201.152.244","109.201.152.245","109.201.152.246","109.201.152.26","109.201.152.5","109.201.152.7","109.201.154.140","109.201.154.143","109.201.154.147","109.201.154.148","109.201.154.150","109.201.154.154","109.201.154.160","109.201.154.163","109.201.154.170","109.201.154.177","109.201.154.178","109.201.154.182","109.201.154.187",
              "109.201.154.188","109.201.154.191","109.201.154.192","109.201.154.201","109.203.108.67","109.230.217.202","109.230.238.165","109.236.82.50","109.236.82.51","109.236.82.52","109.236.82.53","109.74.151.149","109.90.11.45","110.174.43.136","110.93.23.170","114.158.53.117","117.18.75.235","119.81.250.152","120.29.217.46","120.56.162.51","120.56.165.205","120.56.170.24","120.56.173.144","120.56.174.74","120.57.117.25","120.57.120.121","120.57.124.132","120.57.124.4","120.59.45.27","120.59.46.221","121.127.250.156","121.54.175.50","125.212.205.179","128.153.145.125","128.199.239.145","128.199.77.234","128.199.87.155","128.52.128.105","129.127.254.213","134.3.54.196","136.0.2.235","136.243.98.54","137.116.195.139","139.162.10.72","139.162.144.155","139.162.217.219","14.136.236.132","14.186.136.206","14.186.217.226","14.186.249.4","14.202.230.49","141.105.68.12","141.138.141.208","141.239.145.149","141.239.145.193","141.239.145.226","141.239.243.208","141.255.165.138","141.255.189.161","142.4.205.238","142.4.206.84","142.4.213.25","145.133.5.247","146.0.72.180","146.0.77.237","146.115.145.143","146.185.177.103","146.185.239.240","146.198.75.192","147.75.194.73","148.163.73.112","149.202.167.26","149.202.42.188","149.202.47.181","149.202.98.160","149.202.98.161","149.202.98.162","149.210.157.19","149.62.148.41","149.91.83.212","150.107.150.101","150.107.150.102","150.145.1.88","151.1.182.128","151.80.132.88","151.80.138.19","151.80.164.147","151.80.164.158","151.80.175.238","151.80.37.117","151.80.38.15","153.127.255.51","153.92.126.135","154.127.61.249","158.130.0.242","158.193.152.117","158.69.109.58","158.69.192.220","158.69.201.128","158.69.201.229","158.69.208.131","158.69.211.111","158.69.214.111","158.69.215.68","158.69.215.7","159.203.11.12","159.203.15.136","162.213.1.5","162.219.2.177","162.221.184.64","162.221.201.57","162.222.193.69","162.243.96.30","162.244.25.249","162.247.72.199","162.247.72.200","162.247.72.201","162.247.72.202","162.247.72.212","162.247.72.213","162.247.72.216",
              "162.247.72.217","162.247.72.27","162.247.72.7","162.247.73.204","162.247.73.206","162.247.73.74","162.248.10.132","162.248.11.176","162.248.9.218","163.22.17.40","166.70.15.14","166.70.207.2","167.160.168.90","167.88.37.90","168.1.53.231","168.1.6.58","169.1.106.106","171.25.193.131","171.25.193.132","171.25.193.20","171.25.193.235","171.25.193.25","171.25.193.77","171.25.193.78","172.98.67.71","173.14.173.227","173.208.193.59","173.208.213.114","173.243.112.148","173.254.216.66","173.254.216.67","173.254.216.68","173.254.216.69","173.255.196.30","173.255.210.205","173.255.226.142","173.255.232.192","173.3.91.213","176.10.104.240","176.10.104.243","176.10.107.180","176.10.99.200","176.10.99.201","176.10.99.202","176.10.99.203","176.10.99.204","176.10.99.205","176.10.99.206","176.10.99.207","176.10.99.208","176.10.99.209","176.123.29.69","176.123.29.90","176.123.6.153","176.123.6.154","176.123.6.155","176.123.6.156","176.123.6.157","176.126.252.11","176.126.252.12","176.126.85.175","176.126.85.176","176.15.20.133","176.194.104.134","176.194.110.239","176.31.121.196","176.31.191.26","176.31.215.157","176.37.40.213","176.53.21.213","176.58.100.98","176.61.147.146","176.77.71.170","176.9.145.194","176.94.109.57","177.103.233.132","178.137.180.181",
              "178.140.98.88","178.151.182.123","178.17.174.10","178.17.174.99","178.17.41.141","178.175.128.50","178.175.131.194","178.18.17.204","178.2.167.222","178.20.55.16","178.20.55.18","178.208.107.140","178.217.187.39","178.219.245.214","178.238.223.67","178.238.225.108","178.238.237.44","178.254.31.209","178.32.181.98","178.32.181.99","178.32.53.154","178.32.53.53","178.32.53.94","178.33.26.3","178.57.218.42","178.6.82.152","178.62.135.191","178.62.217.233","178.63.94.144","178.65.132.11","178.65.190.134","178.68.97.222","178.89.2.110","178.9.249.148","179.0.194.199","179.43.143.162","18.125.1.222","18.248.1.85","180.210.203.249","181.41.219.117","181.46.149.49","184.105.220.24","185.10.71.107","185.100.84.82","185.100.85.101","185.100.85.132","185.100.85.138","185.100.85.147","185.100.85.190","185.100.85.191","185.100.85.192","185.100.86.100","185.100.86.128","185.100.86.86","185.101.107.136","185.101.107.189","185.101.156.141","185.104.120.2","185.104.120.3","185.104.120.4","185.104.120.7","185.106.120.153","185.106.92.68","185.112.157.135","185.112.157.217","185.117.82.132","185.12.12.133","185.129.62.62","185.129.62.63","185.16.200.176","185.17.144.138","185.17.184.228","185.22.183.196","185.29.232.82","185.29.8.132","185.34.33.2","185.34.60.43","185.36.100.145","185.38.14.215","185.53.169.61","185.60.144.31","185.60.144.32","185.60.144.33","185.61.148.189","185.61.148.228","185.61.149.193","185.61.149.41","185.61.149.43","185.61.149.51","185.62.190.38","185.65.121.134","185.65.135.227","185.65.200.93","185.66.10.15","185.73.44.54","185.75.56.104","185.75.56.110","185.8.63.16","185.82.202.178","185.86.148.137","185.86.148.150","185.86.148.162","185.86.148.17","185.86.148.27","185.86.149.127","185.86.149.205","185.86.149.248","186.104.38.156","186.214.51.146","187.20.201.61","188.102.43.248","188.105.48.99","188.120.253.39","188.126.81.155","188.129.67.217","188.138.17.37","188.138.61.79","188.138.9.49","188.166.15.35","188.166.180.6","188.166.216.186","188.166.80.153","188.167.69.224","188.18.24.97",
              "188.209.52.109","188.22.171.223","188.232.45.143","188.255.114.223","188.26.11.44","188.40.178.5","188.40.227.34","188.40.50.75","188.78.209.211","188.99.61.64","188.99.62.93","189.110.163.232","189.90.49.34","190.10.8.50","190.21.65.246","190.21.70.255","190.21.92.184","190.21.93.65","190.21.95.76","190.210.98.90","190.216.2.136","191.251.132.57","191.255.151.233","192.121.66.11","192.3.177.167","192.3.203.97","192.3.24.227","192.34.80.176","192.42.116.16","192.99.13.133","192.99.2.137","192.99.41.217","192.99.98.185","193.0.100.130","193.107.222.210","193.107.85.56","193.107.85.57","193.107.85.61","193.107.85.62","193.111.136.162","193.165.138.90","193.171.202.150","193.200.241.195","193.33.216.23","193.40.252.113","193.83.142.208","193.9.28.180","193.90.12.86","193.90.12.87","193.90.12.88","193.90.12.89","193.90.12.90","194.150.168.79","194.150.168.95","194.166.122.35","194.218.3.79","194.63.141.120","194.63.142.176","195.154.15.227","195.154.56.44","195.154.90.122","195.180.11.196","195.19.194.108","195.208.139.132","195.22.126.119","195.228.45.176","195.228.75.131","195.251.166.17","195.254.135.76","195.46.185.37","195.62.53.58","197.164.182.98","197.167.51.135","197.231.221.211","198.100.148.112","198.211.122.191","198.27.127.222",
              "198.46.142.47","198.50.145.72","198.50.200.131","198.50.200.135","198.50.210.164","198.51.75.165","198.58.107.53","198.58.115.210","198.73.50.71","198.96.155.3","199.127.226.150","199.68.196.124","199.68.196.125","199.68.196.126","199.87.154.251","199.87.154.255","2.103.218.9","2.111.70.28","200.101.27.212","200.131.20.110","200.163.32.33","200.63.47.10","200.98.142.76","201.34.18.232","201.93.255.113","203.118.133.156","203.161.103.17","203.166.241.140","203.217.173.146","204.11.50.131","204.124.83.130","204.124.83.134","204.13.164.54","204.17.56.42","204.194.29.4","204.27.60.147","204.8.156.142","204.85.191.30","205.168.84.133","206.217.208.162","206.248.184.127","207.201.223.195","207.201.223.196","207.201.223.197","207.244.70.35","207.244.97.183","208.111.34.48","208.67.1.108","208.67.1.82","208.93.66.155","209.126.100.83","209.133.66.214","209.141.43.114","209.141.43.84","209.141.52.138","209.141.56.40","209.141.58.210","209.159.138.19","209.249.157.69","209.249.180.198","209.66.119.150","210.211.122.204","210.6.250.210","211.76.55.92","212.117.180.21","212.16.104.33","212.20.62.226","212.21.66.6","212.227.106.175","212.24.144.188","212.26.245.34","212.47.227.72","212.47.230.239","212.47.233.13","212.47.234.59","212.47.242.45","212.47.243.140",
              "212.47.246.21","212.47.252.134","212.56.214.54","212.68.46.2","212.7.217.32","212.83.139.152","212.83.40.238","212.83.40.239","212.92.219.15","213.108.105.71","213.126.78.59","213.136.76.37","213.186.7.232","213.21.123.232","213.252.140.118","213.61.149.100","213.95.21.54","213.95.21.59","216.115.3.26","216.131.23.75","216.17.110.252","216.17.99.183","216.185.103.172","216.218.134.12","216.245.218.190","217.115.10.131","217.115.10.132","217.115.10.133","217.115.10.134","217.12.204.104","217.13.197.5","217.147.86.87","217.23.11.95","217.23.11.97","217.23.11.98","217.23.7.25","217.23.7.79","217.23.7.98","217.23.7.99","217.25.160.201","217.25.164.248","217.34.135.230","217.70.191.13","23.20.176.197","23.239.10.144","23.92.16.229","23.92.219.68","23.95.38.135","23.99.60.31","31.162.199.206","31.185.27.1","31.19.176.18","31.192.105.21","31.192.228.185","31.220.45.6","31.23.249.221","31.31.77.242","35.0.127.52","36.55.228.145","37.0.127.44","37.1.215.204","37.120.51.207","37.130.227.133","37.135.76.162","37.147.205.203","37.187.129.166","37.187.19.140","37.187.21.180","37.187.43.27","37.187.7.74","37.218.240.101","37.220.35.202","37.233.99.157","37.46.128.195","37.48.101.193","37.48.115.224","37.48.120.196","37.48.124.116","37.48.124.117","37.48.65.76","37.48.74.42","37.48.74.44","37.48.80.101","37.48.80.73","37.48.81.27","37.49.226.236","37.58.59.88","37.59.112.7","37.59.123.142","37.59.63.190","37.59.97.134","4.31.64.70","41.78.128.134","45.33.48.204","45.55.170.65","45.55.250.97","45.58.202.217","45.79.184.114","45.79.207.176","45.79.85.112","46.10.10.139","46.105.183.141","46.105.183.142","46.118.22.136","46.148.18.34","46.148.18.74","46.148.26.71","46.148.26.78","46.16.234.131","46.165.223.217","46.165.230.5","46.166.170.3","46.166.170.6","46.166.186.214","46.166.186.215","46.166.186.219","46.166.186.235","46.166.186.236","46.166.186.238","46.166.186.241","46.166.186.246","46.166.188.197","46.166.188.201","46.166.188.202","46.166.188.206","46.166.188.207","46.166.188.210","46.166.188.213",
              "46.166.188.218","46.166.188.221","46.166.188.229","46.166.188.233","46.166.188.234","46.166.188.236","46.166.188.239","46.166.188.242","46.166.188.245","46.166.190.130","46.166.190.131","46.166.190.176","46.166.190.178","46.166.190.183","46.166.190.185","46.166.190.191","46.166.190.193","46.166.190.196","46.166.190.205","46.167.245.172","46.182.106.190","46.183.221.231","46.183.222.166","46.183.222.171","46.185.82.138","46.188.10.23","46.20.13.195","46.21.107.230","46.226.108.26","46.233.0.70","46.235.226.226","46.235.227.70","46.242.66.240","46.246.61.81","46.28.68.158","46.29.248.238","46.32.38.60","46.39.102.250","46.4.55.177","46.4.87.172","46.41.132.84","46.45.137.71","46.72.19.222","46.72.74.16","46.73.71.8","47.88.149.116","5.12.167.156","5.135.158.101","5.135.199.14","5.135.66.213","5.140.112.142","5.157.82.219","5.164.154.89","5.165.69.176","5.166.127.154","5.175.194.69","5.189.140.227","5.189.146.133","5.196.1.129","5.196.31.80","5.196.66.162","5.196.72.199","5.199.130.188","5.199.142.195","5.2.128.74","5.2.138.119","5.206.21.38","5.249.145.164","5.39.217.14","5.39.79.8","5.57.103.82","5.79.100.73","5.79.68.161","5.79.70.174","5.79.97.116","5.9.146.203","5.9.195.140","5.9.243.44","50.199.1.178","50.245.124.131","50.247.195.124",
              "50.253.127.139","50.7.124.238","50.7.124.243","50.7.178.100","50.76.159.218","51.254.244.152","51.254.83.238","51.255.202.66","51.255.27.27","51.255.33.216","51.255.38.230","51.255.38.231","52.0.227.77","52.0.4.72","52.1.245.147","52.10.36.66","52.2.163.62","52.26.85.74","54.144.217.49","54.65.241.98","54.68.29.170","54.88.228.147","59.127.163.155","59.179.17.195","60.248.162.179","61.230.110.17","61.230.163.192","61.230.195.45","61.230.207.86","62.102.148.67","62.133.130.105","62.141.120.218","62.141.55.117","62.149.12.153","62.149.25.15","62.210.105.116","62.210.37.82","62.212.73.141","62.218.77.122","62.57.160.237","62.75.245.47","63.141.251.14","63.223.69.103","64.113.32.29","64.18.82.164","64.187.226.244","65.129.133.77","65.181.112.128","65.181.118.10","65.181.123.254","65.183.154.104","65.19.167.130","65.19.167.131","65.19.167.132","65.49.60.164","65.52.150.162","66.180.193.219","66.220.3.179","66.230.230.230","66.85.131.72","67.215.255.140","68.233.235.217","69.162.107.5","69.162.139.9","69.164.207.234","69.164.209.8","69.172.229.199","70.164.255.174","71.135.34.176","71.135.40.11","71.135.41.180","71.135.46.241","71.222.146.26","72.14.176.172","72.14.179.10","72.52.75.27","73.135.243.103","73.172.157.202","74.122.198.101","74.142.74.156","74.50.54.68","76.180.178.101","76.85.207.212","77.102.66.134","77.109.139.87","77.13.20.73","77.13.28.76","77.181.10.118","77.182.169.244","77.182.63.136","77.182.69.66","77.199.236.197","77.203.78.244","77.247.181.162","77.247.181.163","77.247.181.165","77.247.182.241","77.4.54.20","77.45.141.51","77.45.143.0","77.45.155.94","77.45.182.233","77.51.163.148","77.51.165.227","77.66.108.158","77.68.226.175","77.81.104.124","77.81.240.41","78.106.157.127","78.107.237.16","78.128.40.89","78.142.175.70","78.142.19.59","78.247.15.126","78.31.164.41","78.37.193.86","78.37.199.247","78.37.207.254","78.37.223.25","78.37.233.88","78.41.115.145","78.46.97.213","78.47.246.35","78.47.61.222","78.66.111.35","78.70.160.25","78.84.246.101","79.132.235.92","79.134.255.200",
              "79.136.42.226","79.143.87.204","79.172.193.32","79.208.215.105","79.208.222.185","79.208.222.99","79.210.207.5","79.210.208.107","79.210.227.96","79.215.100.108","79.219.208.185","79.98.107.90","80.110.190.147","80.139.168.62","80.162.0.113","80.169.241.76","80.189.35.122","80.240.139.111","80.241.60.207","80.244.81.191","80.248.208.131","80.57.206.190","80.79.23.7","80.82.215.199","81.176.228.54","81.191.240.34","81.2.242.62","81.2.245.158","81.209.35.112","81.242.80.226","81.242.81.23","81.242.81.57","81.245.239.146","81.7.15.115","81.7.17.171","81.89.0.195","81.89.0.196","81.89.0.197","81.89.0.198","81.89.0.199","81.89.0.200","81.89.0.201","81.89.0.202","81.89.0.203","81.89.0.204","82.103.138.89","82.116.120.3","82.139.198.11","82.165.142.79","82.211.19.129","82.211.19.143","82.221.101.29","82.221.129.96","82.228.252.20","82.251.170.80","82.253.188.248","82.254.201.168","82.65.33.170","82.69.50.50","83.160.95.99","83.220.169.176","83.222.249.220","83.227.52.174","83.233.119.138","83.238.163.214","84.10.161.99","84.110.54.128","84.132.32.205","84.136.228.102","84.136.234.115","84.161.106.109","84.19.190.106","84.194.92.197","84.200.82.163","84.215.135.143","84.234.221.122","84.255.239.131","84.3.0.53","84.48.199.78","84.53.232.154",
              "84.92.24.214","85.10.210.199","85.119.82.4","85.143.95.50","85.144.220.247","85.158.152.122","85.17.148.230","85.17.177.73","85.214.11.209","85.214.155.116","85.214.202.115","85.214.98.239","85.23.243.147","85.24.215.117","85.25.103.119","85.25.103.12","85.25.133.64","85.25.84.142","85.250.153.210","85.4.52.186","85.74.24.210","85.93.18.64","85.93.218.204","86.166.89.62","86.56.175.82","86.56.37.188","87.106.20.246","87.118.84.181","87.118.91.140","87.12.233.240","87.120.37.136","87.120.37.14","87.148.14.4","87.169.104.127","87.169.119.118","87.19.18.77","87.19.224.45","87.236.195.185","87.245.244.162","87.252.5.163","87.98.178.61","87.98.250.222","87.98.250.244","88.166.192.181","88.167.163.142","88.190.118.95","88.190.76.92","88.198.120.155","88.198.14.171","88.198.43.41","88.198.56.140","88.77.145.12","88.77.222.251","89.108.87.75","89.140.119.148","89.140.119.150","89.18.174.19","89.187.142.208","89.187.144.122","89.218.16.7","89.23.177.232","89.234.157.254","89.239.218.191","89.31.57.5","89.31.96.168","89.34.237.12","89.46.100.13","89.46.100.182","89.67.77.136","90.146.134.80","90.148.12.205","90.151.148.200","90.182.235.46","90.231.152.159","91.106.159.222","91.109.206.106","91.109.247.173","91.138.4.11","91.138.5.145","91.138.70.15","91.146.121.3","91.199.149.139","91.199.197.76","91.203.212.201","91.203.5.165","91.206.142.70","91.213.8.235","91.213.8.236","91.213.8.43","91.213.8.64","91.213.8.84","91.219.236.218","91.219.236.222","91.219.236.232","91.219.237.244","91.220.220.5","91.221.110.4","91.226.212.160","91.229.77.64","91.233.106.121","91.234.226.35","91.250.241.241","91.44.206.132","91.51.225.74","91.51.233.28","91.58.211.31","91.58.215.216","91.58.215.236","91.82.237.127","92.111.156.14","92.195.112.19","92.195.216.177","92.195.4.237","92.195.86.9","92.222.103.234","92.222.127.101","92.222.6.12","92.78.124.74","93.115.241.2","93.115.95.201","93.115.95.202","93.115.95.204","93.115.95.205","93.115.95.206","93.115.95.207","93.115.95.216","93.129.250.73","93.158.215.174","93.174.89.138",
              "93.174.90.30","93.174.93.133","93.174.93.154","93.184.66.227","93.186.170.7","93.191.128.252","93.211.246.32","93.230.161.90","93.64.207.55","93.95.228.115","93.95.228.116","93.95.228.220","93.95.228.5","93.95.228.82","94.102.52.41","94.102.53.177","94.142.242.84","94.198.100.17","94.199.51.101","94.210.0.28","94.229.154.147","94.23.247.86","94.23.252.31","94.231.175.89","94.242.195.186","94.242.206.183","94.242.206.35","94.242.228.108","94.242.246.23","94.242.246.24","94.242.250.117","94.242.253.92","94.242.57.2","94.242.57.38","94.243.186.3","94.26.140.150","94.6.251.135","95.105.164.157","95.128.43.164","95.130.10.216","95.130.11.147","95.130.11.155","95.130.12.37","95.130.12.91","95.130.13.157","95.140.42.183","95.142.161.63","95.154.24.73","95.157.8.60","95.163.107.14","95.163.107.15","95.163.107.16","95.163.107.36","95.163.107.61","95.163.107.9","95.163.121.105","95.163.121.131","95.163.121.140","95.183.49.224","95.211.184.250","95.211.205.151","95.211.226.242","95.211.226.243","95.215.44.194","95.215.45.142","95.215.45.187","95.215.46.36","95.215.46.72","95.215.47.107","95.223.204.243","95.238.239.91","95.252.73.254","95.69.233.211","95.73.125.97","95.85.10.71","96.35.130.131","96.58.40.136","97.74.237.196","98.26.106.139","99.95.213.114"];

var server = https.createServer(options, function (req, res) {
	res.writeHead(200, {
		"Access-Control-Allow-Origin": "*",
		"Content-Type": "application/json"
	});

	if (torIps.indexOf(req.connection.remoteAddress) !== -1) res.end('{"error": "Nah tor isn\'t cool man."}');

	var parsedUrl = urlParser.parse(req.url, true);

	if (parsedUrl.pathname == "/register") {
		if (parsedUrl.query.key !== JOIN_CODE) {
			res.end('{"error": "Wrong register \'key\'"}');
			return;
		}

		var url = parsedUrl.query.url;
		if (!url) {
			res.end('{"error": "No url provided"}');
			return;
		}

		if (url.indexOf("localhost") !== -1) {
			getIp(function (err, ip) {
				if (err) throw err;
				url = url.replace("localhost", ip);
				var id = servers.add(url);
		                res.end('{"success": "Registered", "id": "' + id + '"}');
		                console.log("[REGISTERED]", id, url)
			});
			return
		}

		var id = servers.add(url);
		res.end('{"success": "Registered", "id": "' + id + '"}');
		console.log("[REGISTERED]", id, url)
		return;
	}

	if (parsedUrl.pathname == "/getserver") {
		var room = parsedUrl.query.room;

		// This one means we wanted this room
		// Be a bit more lenient about the amount of people allowed
		var specificOverride = parsedUrl.query.specificoverride;

		var maxOverride = parsedUrl.query.maxoverride; // This one can be forced

		if (!room) {
			res.end('{"error": "You did not provide the required room query"}');
			return;
		}

		if (!room_regex.test(room)) {
			res.end('{"error": "Room names should only contain lowercase letters, numbers and _"}');
			return;
		}

		var server = servers.getServerFromRoom(room);
		if (!server) {
			res.end('{"error": "No server available!"}');
			return;
		}

		if (server.rooms[room] > MAX_USERS_PER_ROOM && !maxOverride && !specificOverride) {
			res.end('{"error": "Too many users"}');
			return;
		}

		if (server.rooms[room] > MAX_USERS_PER_ROOM_IF_SPECIFIC && !maxOverride) {
			res.end('{"error": "Too many users in this room"}');
			return;
		}
	
		res.end('{"server": "' + server.url + '"}');
		return;
	}

	if (parsedUrl.pathname == "/getgameroom") {
		var maxOverride = parsedUrl.query.maxoverride;
		var data = servers.getFreePublicGameRoom();

		if (!data.server) {
			res.end('{"error": "No server found"}');
			return;
		}

		res.end(JSON.stringify({
			room: data.room,
			server: data.server.url
		}));
		return;
	}

	if (parsedUrl.pathname == "/isourroom") {
		var room = parsedUrl.query.room;
		var id = parsedUrl.query.id;

		var server = servers.getServerFromRoom(room);
		if (!server) {
			res.end('{"error": "No server found"}');
			return;
		}

		if (server.id == id) {
			res.end('{"isours": true}');
			return;
		}

		res.end('{"isours": false}');
		return;
	}

	if (parsedUrl.pathname == "/getrooms") {
		var rooms = servers.getRooms();

		rooms.main = rooms.main || 0;
		rooms.member_main = rooms.member_main || 0;

		res.end('{"rooms": ' + JSON.stringify(rooms) + '}');
		return;
	}

	if (parsedUrl.pathname == "/update") {
		var id = parsedUrl.query.id;

		console.log(parsedUrl.query.rooms);

		try {
			var rooms = JSON.parse(parsedUrl.query.rooms);
		} catch (e) {
			res.end('{"error": "Rooms was not valid JSON!"}');
			return;
		}

		if (!servers.setLoad(id, rooms)) {
			res.end('{"error": "No server with this id"}');
			return;
		}

		res.end('{"success": "Player count updated"}');
		return;
	}

	if (parsedUrl.pathname == "/status") {
		var pass = parsedUrl.query.pass;
		if (pass !== statuscode) {
			res.end('{"error": "No pass provided or wrong!"}');
			return;
		}

		res.end('{"servers": ' + JSON.stringify(servers.servers) + '}');
		return;
	}

	console.log("[URL REQUEST UNKOWN] ", req.connection.remoteAddress, parsedUrl);	
	res.end('{"error": "Unknown command"}');
}).listen(config.service.loadbalancer.port);
