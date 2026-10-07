#include"ticket.h"
#include"cinema.h"
#include<iostream>
ticket::ticket(
            const int newid,
            const std::string& newname,
            const int newfilmid,
            const int newseatrow,
            const int newseatcolumn,
            const int newprice,
            const ticketstatus newstatus
        ):
        id(newid),
        name(newname),
        filmid(newfilmid),
        seatrow(newseatrow),
        seatcolumn(newseatcolumn),
        price(newprice),
        status(newstatus)
    {
}
int ticket::getid() const
{
    return id;
}
const std::string& ticket::getname() const
{
    return name;
}
int ticket::getfilmid() const
{
    return filmid;
}
int ticket::getseatrow() const
{
    return seatrow;
}
int ticket::getseatcolumn() const
{
    return seatcolumn;
}
int ticket::getprice() const
{
    return price;
}
ticketstatus ticket::getstatus() const
{
    return status;
}
bool ticket::fundticket()
{
    if(status == ticketstatus::valid)
    {
        status = ticketstatus::funded;
        return true;
    }
    else
        return false;
}
void ticket::showinfo() const
{
    std::cout << "电影票编号:" << getid() << '\n';
    std::cout << "购票人:" << getname() << '\n';
    std::cout << "场次编号:" << getfilmid() << '\n';
    std::cout << "所在行数:" << getseatrow() << '\n';
    std::cout << "所在列数:" << getseatcolumn() << '\n';
    std::cout << "票价:" << getprice() << '\n';
    std::cout << "是否退款:";
    if(status == ticketstatus::funded)
    {
        std::cout << "是\n";
    }
    else
    {
        std::cout << "否\n";
    }
}