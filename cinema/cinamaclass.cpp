#include<iostream>
#include"cinema.h"
film::film(
    const int newid,
    const std::string& newname,
    const std::string& newtime,
    const std::string& newcinemaname,
    float newprice,
    const std::vector<std::vector<int>>& newseat
):id(newid),name(newname),time(newtime),cinemaname(newcinemaname),price(newprice),seat(newseat)
{
};
int film::getid() const
{
    return id;
}
const std::string& film::getname() const
{
    return name;
}
const std::string& film::gettime() const
{
    return time;
}
const std::string& film::getcinemaname() const
{
    return cinemaname;
}
float film::getprice() const
{
    return price;
}
void film::showinfo() const
{
    std::cout << "场次编号:" << id << '\n';
    std::cout << "电影名称:" << name <<'\n';
    std::cout << "放映时间:" << time <<'\n';
    std::cout << "票价:" << price << '\n';
    std::cout << "影院名称:" << cinemaname << '\n';
    std::cout << "当前座位:\n";
    showseat();
}
void film::showseat() const
{
    int row = 0;
    int column = 0;
    for(row = 0;row < seat.size();row++)
    {
        for(column = 0;column < seat[row].size();column++)
        {
            if(seat[row][column] == seatstatus::availble)
            {
                std::cout << 'O';
            }
            else
            {
                std::cout << 'X';
            }
        }
        std::cout << '\n';
    }
}
bool film::isseatvalid(int row,int column) const
{
    if(row < 0 || 
        row >= seat.size() || 
        column < 0 ||
        column >= seat[0].size()
    )
    {
        std::cout << "该座位不合法\n";
        return false;
    }
    else
        return true;
}
bool film::sellseat(int row,int column)
{
    if(isseatvalid(row,column))
    {
        if(seat[row][column] == seatstatus::sold)
        {
            return false;
        }
        else
        {
            seat[row][column] = seatstatus::sold;
            return true;
        }
    }
    else
        return false;
}
bool film::refundseat(int row,int column)
{
    if(isseatvalid(row,column))
    {
        if(seat[row][column] == seatstatus::availble)
            return false;
        else
        {
            seat[row][column] = seatstatus::availble;
            return true;
        }
    }
    else
        return false;
}
int film::getsoldcount() const
{
    int soldcount = 0;
    for(int row = 0;row < seat.size();row++)
    {
        for(int column = 0;column < seat[row].size();column++)
        {
            if(seat[row][column] == seatstatus::sold)
            {
                soldcount += 1;
            }
        }
    }
    return soldcount;
}
int film::gettotalcount() const
{
    int total = 0;
    for(int row = 0;row < seat.size();row++)
    {
        for(int column = 0;column < seat[row].size();column++)
        {
            total += 1;
        }
    }
    return total;
}
int film::getremainingcount() const
{
    return (gettotalcount() - getsoldcount());
}
float film::getevenue() const
{
    return (price * getsoldcount());
}
float film::getoccupancyrate() const
{
    int total = gettotalcount();

if (total == 0)
    return 0.0;

    return static_cast<double>(getsoldcount()) / total * 100;
}